/**
 * Job Queue Service
 * 
 * Centralized job queue management using Bull with Redis backend.
 * Provides queue instances and helper functions for background job processing.
 */

const Queue = require('bull');

// Redis connection URL
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Job queues
let analysisQueue = null;
let enrichQueue = null;
let analyticsBuilderQueue = null;

// Active SSE clients for progress updates
const sseClients = new Map();

/**
 * Initialize job queues
 * Must be called after environment variables are loaded
 */
function initializeQueues() {
    const redisOptions = {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        retryStrategy: (times) => {
            if (times > 3) {
                console.error('[JobQueue] Redis connection failed after 3 retries');
                return null;
            }
            return Math.min(times * 200, 2000);
        }
    };

    // Analysis queue - for menu analysis jobs
    analysisQueue = new Queue('menu-analysis', REDIS_URL, {
        redis: redisOptions,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 50,      // Keep last 50 failed jobs
            timeout: 600000        // 10 minutes max
        }
    });

    // Enrich queue - for order enrichment jobs
    enrichQueue = new Queue('order-enrichment', REDIS_URL, {
        redis: redisOptions,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: 100,
            removeOnFail: 50,
            timeout: 600000
        }
    });

    // Analytics Builder queue - for building analytics materialized views
    analyticsBuilderQueue = new Queue('analytics-builder', REDIS_URL, {
        redis: redisOptions,
        defaultJobOptions: {
            attempts: 2,
            backoff: {
                type: 'exponential',
                delay: 3000
            },
            removeOnComplete: 50,
            removeOnFail: 25,
            timeout: 1800000  // 30 minutes max (for large datasets)
        }
    });

    // Queue event handlers for analysis queue
    analysisQueue.on('error', (error) => {
        console.error('[JobQueue] Analysis queue error:', error);
    });

    analysisQueue.on('waiting', (jobId) => {
        console.log(`[JobQueue] Job ${jobId} is waiting`);
    });

    analysisQueue.on('active', (job) => {
        console.log(`[JobQueue] Job ${job.id} has started processing`);
        broadcastProgress(job.id, {
            status: 'active',
            progress: 0,
            message: 'Job started'
        });
    });

    analysisQueue.on('progress', (job, progress) => {
        console.log(`[JobQueue] Job ${job.id} progress: ${JSON.stringify(progress)}`);
        broadcastProgress(job.id, {
            status: 'active',
            ...progress
        });
    });

    analysisQueue.on('completed', (job, result) => {
        console.log(`[JobQueue] Job ${job.id} completed`);
        broadcastProgress(job.id, {
            status: 'completed',
            progress: 100,
            result
        });
        // Clean up SSE clients for this job
        setTimeout(() => {
            sseClients.delete(job.id);
        }, 5000);
    });

    analysisQueue.on('failed', (job, error) => {
        console.error(`[JobQueue] Job ${job.id} failed:`, error.message);
        broadcastProgress(job.id, {
            status: 'failed',
            error: error.message
        });
    });

    // Analytics Builder queue event handlers
    analyticsBuilderQueue.on('error', (error) => {
        console.error('[JobQueue] Analytics Builder queue error:', error);
    });

    analyticsBuilderQueue.on('active', (job) => {
        console.log(`[JobQueue] Analytics Builder job ${job.id} started`);
        broadcastProgress(job.id, {
            type: 'progress',
            status: 'active',
            progress: 0,
            message: 'Starting analytics build...'
        });
    });

    analyticsBuilderQueue.on('progress', (job, progress) => {
        console.log(`[JobQueue] Analytics Builder job ${job.id} progress:`, progress);
        broadcastProgress(job.id, {
            type: 'progress',
            status: 'active',
            ...progress
        });
    });

    analyticsBuilderQueue.on('completed', (job, result) => {
        console.log(`[JobQueue] Analytics Builder job ${job.id} completed`);
        broadcastProgress(job.id, {
            type: 'status',
            status: 'completed',
            progress: 100,
            result
        });
        setTimeout(() => {
            sseClients.delete(job.id);
        }, 5000);
    });

    analyticsBuilderQueue.on('failed', (job, error) => {
        console.error(`[JobQueue] Analytics Builder job ${job.id} failed:`, error.message);
        broadcastProgress(job.id, {
            type: 'status',
            status: 'failed',
            error: error.message
        });
    });

    console.log('[JobQueue] Queues initialized');
    return { analysisQueue, enrichQueue, analyticsBuilderQueue };
}

/**
 * Get the analysis queue instance
 */
function getAnalysisQueue() {
    if (!analysisQueue) {
        throw new Error('Job queues not initialized. Call initializeQueues() first.');
    }
    return analysisQueue;
}

/**
 * Get the enrich queue instance
 */
function getEnrichQueue() {
    if (!enrichQueue) {
        throw new Error('Job queues not initialized. Call initializeQueues() first.');
    }
    return enrichQueue;
}

/**
 * Get the analytics builder queue instance
 */
function getAnalyticsBuilderQueue() {
    if (!analyticsBuilderQueue) {
        throw new Error('Job queues not initialized. Call initializeQueues() first.');
    }
    return analyticsBuilderQueue;
}

/**
 * Add a client to receive SSE updates for a job
 * @param {string} jobId - The job ID
 * @param {Object} res - Express response object for SSE
 */
function addSSEClient(jobId, res) {
    if (!sseClients.has(jobId)) {
        sseClients.set(jobId, new Set());
    }
    sseClients.get(jobId).add(res);
    
    console.log(`[JobQueue] SSE client added for job ${jobId}`);
}

/**
 * Remove an SSE client
 * @param {string} jobId - The job ID
 * @param {Object} res - Express response object
 */
function removeSSEClient(jobId, res) {
    const clients = sseClients.get(jobId);
    if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
            sseClients.delete(jobId);
        }
    }
}

/**
 * Broadcast progress to all SSE clients for a job
 * @param {string} jobId - The job ID
 * @param {Object} data - Progress data to send
 */
function broadcastProgress(jobId, data) {
    const clients = sseClients.get(jobId);
    if (clients && clients.size > 0) {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        clients.forEach(res => {
            try {
                res.write(message);
            } catch (error) {
                console.error('[JobQueue] Error writing to SSE client:', error);
                removeSSEClient(jobId, res);
            }
        });
    }
}

/**
 * Get job by ID
 * Checks all queues to find the job
 * @param {string} jobId - The job ID
 * @returns {Promise<Object|null>} Job object or null
 */
async function getJob(jobId) {
    // Check analytics builder queue first (if job ID starts with "analytics-build")
    if (jobId.startsWith('analytics-build') && analyticsBuilderQueue) {
        const job = await analyticsBuilderQueue.getJob(jobId);
        if (job) return job;
    }
    
    // Check analysis queue
    if (analysisQueue) {
        const job = await analysisQueue.getJob(jobId);
        if (job) return job;
    }
    
    // Check enrich queue
    if (enrichQueue) {
        const job = await enrichQueue.getJob(jobId);
        if (job) return job;
    }
    
    return null;
}

/**
 * Get job status and progress
 * @param {string} jobId - The job ID
 * @returns {Promise<Object>} Job status object
 */
async function getJobStatus(jobId) {
    const job = await getJob(jobId);
    
    if (!job) {
        return {
            exists: false,
            status: 'not_found',
            error: 'Job not found'
        };
    }

    const state = await job.getState();
    const progress = job.progress();
    
    return {
        exists: true,
        id: job.id,
        status: state,
        progress: typeof progress === 'object' ? progress : { percent: progress },
        data: job.data,
        createdAt: new Date(job.timestamp),
        processedOn: job.processedOn ? new Date(job.processedOn) : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue
    };
}

/**
 * Graceful shutdown - close all queues
 */
async function closeQueues() {
    console.log('[JobQueue] Closing queues...');
    
    if (analysisQueue) {
        await analysisQueue.close();
    }
    if (enrichQueue) {
        await enrichQueue.close();
    }
    if (analyticsBuilderQueue) {
        await analyticsBuilderQueue.close();
    }
    
    console.log('[JobQueue] All queues closed');
}

module.exports = {
    initializeQueues,
    getAnalysisQueue,
    getEnrichQueue,
    getAnalyticsBuilderQueue,
    addSSEClient,
    removeSSEClient,
    broadcastProgress,
    getJob,
    getJobStatus,
    closeQueues
};
