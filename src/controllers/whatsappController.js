/**
 * WhatsApp Controller
 * 
 * Handles WhatsApp broadcast messaging via Twilio API.
 * Supports templates, scheduled broadcasts, and delivery tracking.
 */

const { ObjectId } = require('mongodb');
const { getUnifiedRestaurants } = require('../utils/multiDbConnection');

// Twilio client initialization (lazy loaded)
let twilioClient = null;
function getTwilioClient() {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
    }
    return twilioClient;
}

const whatsappController = {
    // ==================== TEMPLATES ====================

    /**
     * Get all templates
     */
    getTemplates: async (req, res, db) => {
        try {
            const { category, isActive } = req.query;

            const query = {};
            if (category) query.category = category;
            if (isActive !== undefined) query.isActive = isActive === 'true';

            const templates = await db.collection('whatsappTemplates')
                .find(query)
                .sort({ category: 1, name: 1 })
                .toArray();

            res.json({
                success: true,
                data: templates,
            });
        } catch (error) {
            console.error('[WhatsApp] Error getting templates:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get template by ID
     */
    getTemplateById: async (req, res, db) => {
        try {
            const { id } = req.params;

            const template = await db.collection('whatsappTemplates').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!template) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Template not found' 
                });
            }

            res.json({
                success: true,
                data: template,
            });
        } catch (error) {
            console.error('[WhatsApp] Error getting template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create new template
     */
    createTemplate: async (req, res, db) => {
        try {
            const {
                name,
                category,
                icon,
                subject,
                messageLao,
                messageEnglish,
                variables,
                quickResponses,
            } = req.body;

            if (!name || !messageLao) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'name and messageLao are required' 
                });
            }

            // Check if name already exists
            const existing = await db.collection('whatsappTemplates').findOne({ name });
            if (existing) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Template with this name already exists' 
                });
            }

            const template = {
                name,
                category: category || 'general',
                icon: icon || '📱',
                subject: subject || '',
                messageLao,
                messageEnglish: messageEnglish || '',
                variables: variables || [],
                quickResponses: quickResponses || [],
                isActive: true,
                usageCount: 0,
                lastUsedAt: null,
                createdBy: req.user?.id || 'system',
                updatedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('whatsappTemplates').insertOne(template);

            res.status(201).json({
                success: true,
                data: {
                    ...template,
                    _id: result.insertedId,
                },
            });
        } catch (error) {
            console.error('[WhatsApp] Error creating template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Update template
     */
    updateTemplate: async (req, res, db) => {
        try {
            const { id } = req.params;
            const updates = req.body;

            delete updates._id;
            delete updates.createdAt;
            delete updates.createdBy;
            delete updates.usageCount;

            updates.updatedAt = new Date();
            updates.updatedBy = req.user?.id || 'system';

            const result = await db.collection('whatsappTemplates').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Template not found' 
                });
            }

            const updatedTemplate = await db.collection('whatsappTemplates').findOne({ 
                _id: new ObjectId(id) 
            });

            res.json({
                success: true,
                data: updatedTemplate,
            });
        } catch (error) {
            console.error('[WhatsApp] Error updating template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Delete template
     */
    deleteTemplate: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('whatsappTemplates').deleteOne({ 
                _id: new ObjectId(id) 
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Template not found' 
                });
            }

            res.json({
                success: true,
                message: 'Template deleted',
            });
        } catch (error) {
            console.error('[WhatsApp] Error deleting template:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ==================== BROADCASTS ====================

    /**
     * Get all broadcasts
     */
    getBroadcasts: async (req, res, db) => {
        try {
            const { status, limit = 50, skip = 0 } = req.query;

            const query = {};
            if (status) query.status = status;

            const [broadcasts, total] = await Promise.all([
                db.collection('whatsappBroadcasts')
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(parseInt(skip))
                    .limit(parseInt(limit))
                    .toArray(),
                db.collection('whatsappBroadcasts').countDocuments(query),
            ]);

            res.json({
                success: true,
                data: broadcasts,
                pagination: { total, limit: parseInt(limit), skip: parseInt(skip) },
            });
        } catch (error) {
            console.error('[WhatsApp] Error getting broadcasts:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get broadcast by ID
     */
    getBroadcastById: async (req, res, db) => {
        try {
            const { id } = req.params;

            const broadcast = await db.collection('whatsappBroadcasts').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!broadcast) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Broadcast not found' 
                });
            }

            res.json({
                success: true,
                data: broadcast,
            });
        } catch (error) {
            console.error('[WhatsApp] Error getting broadcast:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Create and optionally send broadcast
     */
    createBroadcast: async (req, res, db) => {
        try {
            const {
                name,
                templateId,
                message,
                subject,
                recipientCriteria,
                customRecipientIds,
                variableValues,
                scheduledAt,
                sendNow,
            } = req.body;

            if (!message) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'message is required' 
                });
            }

            // Build recipients list based on criteria
            let recipients = [];
            
            if (customRecipientIds && customRecipientIds.length > 0) {
                // Custom selection - use provided IDs
                // TODO: Fetch restaurant details for these IDs
                recipients = customRecipientIds.map(id => ({
                    restaurantId: id.restaurantId,
                    posVersion: id.posVersion,
                    restaurantName: id.name,
                    phone: id.phone,
                    whatsapp: id.whatsapp,
                    status: 'pending',
                }));
            } else {
                // Get recipients based on criteria
                const result = await getUnifiedRestaurants({
                    posVersion: recipientCriteria?.posVersion || 'both',
                    province: recipientCriteria?.province,
                    subscriptionStatus: recipientCriteria?.status,
                    limit: 10000,
                    skip: 0,
                });

                recipients = result.data
                    .filter(r => r.phone || r.whatsapp) // Only include those with phone/whatsapp
                    .map(r => ({
                        restaurantId: r.restaurantId,
                        posVersion: r.posVersion,
                        restaurantName: r.name,
                        phone: r.phone,
                        whatsapp: r.whatsapp,
                        status: 'pending',
                    }));
            }

            if (recipients.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No recipients found matching criteria' 
                });
            }

            // Replace variables in message
            let finalMessage = message;
            if (variableValues) {
                Object.entries(variableValues).forEach(([key, value]) => {
                    finalMessage = finalMessage.replace(new RegExp(`{${key}}`, 'g'), value);
                });
            }

            const broadcast = {
                name: name || `Broadcast ${new Date().toISOString()}`,
                templateId: templateId || null,
                subject: subject || '',
                message: finalMessage,
                recipientCriteria: recipientCriteria || { type: 'custom' },
                recipients,
                stats: {
                    totalRecipients: recipients.length,
                    sent: 0,
                    delivered: 0,
                    read: 0,
                    failed: 0,
                },
                status: scheduledAt ? 'scheduled' : (sendNow ? 'sending' : 'draft'),
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                startedAt: null,
                completedAt: null,
                createdBy: req.user?.id || 'system',
                updatedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const result = await db.collection('whatsappBroadcasts').insertOne(broadcast);
            broadcast._id = result.insertedId;

            // Update template usage if using a template
            if (templateId) {
                await db.collection('whatsappTemplates').updateOne(
                    { _id: new ObjectId(templateId) },
                    { 
                        $inc: { usageCount: 1 },
                        $set: { lastUsedAt: new Date() }
                    }
                );
            }

            // Send immediately if requested
            if (sendNow) {
                // Start sending in background
                sendBroadcastMessages(db, broadcast._id.toString()).catch(err => {
                    console.error('[WhatsApp] Error in background send:', err);
                });
            }

            res.status(201).json({
                success: true,
                data: broadcast,
                message: sendNow 
                    ? `Broadcast started. Sending to ${recipients.length} recipients.`
                    : `Broadcast created with ${recipients.length} recipients.`,
            });
        } catch (error) {
            console.error('[WhatsApp] Error creating broadcast:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Send/resume a broadcast
     */
    sendBroadcast: async (req, res, db) => {
        try {
            const { id } = req.params;

            const broadcast = await db.collection('whatsappBroadcasts').findOne({ 
                _id: new ObjectId(id) 
            });

            if (!broadcast) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Broadcast not found' 
                });
            }

            if (broadcast.status === 'completed') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Broadcast already completed' 
                });
            }

            // Update status
            await db.collection('whatsappBroadcasts').updateOne(
                { _id: new ObjectId(id) },
                { 
                    $set: { 
                        status: 'sending',
                        startedAt: broadcast.startedAt || new Date(),
                        updatedAt: new Date(),
                    }
                }
            );

            // Start sending in background
            sendBroadcastMessages(db, id).catch(err => {
                console.error('[WhatsApp] Error in background send:', err);
            });

            res.json({
                success: true,
                message: 'Broadcast sending started',
            });
        } catch (error) {
            console.error('[WhatsApp] Error sending broadcast:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Cancel a broadcast
     */
    cancelBroadcast: async (req, res, db) => {
        try {
            const { id } = req.params;

            const result = await db.collection('whatsappBroadcasts').updateOne(
                { 
                    _id: new ObjectId(id),
                    status: { $in: ['draft', 'scheduled', 'sending'] }
                },
                { 
                    $set: { 
                        status: 'cancelled',
                        updatedAt: new Date(),
                        updatedBy: req.user?.id || 'system',
                    }
                }
            );

            if (result.matchedCount === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Broadcast not found or cannot be cancelled' 
                });
            }

            res.json({
                success: true,
                message: 'Broadcast cancelled',
            });
        } catch (error) {
            console.error('[WhatsApp] Error cancelling broadcast:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get recipient list for preview
     */
    previewRecipients: async (req, res, db) => {
        try {
            const { posVersion, province, status, limit = 20 } = req.query;

            const result = await getUnifiedRestaurants({
                posVersion: posVersion || 'both',
                province,
                subscriptionStatus: status,
                limit: parseInt(limit),
                skip: 0,
            });

            // Filter to those with contact info
            const recipientsWithContact = result.data.filter(r => r.phone || r.whatsapp);

            res.json({
                success: true,
                data: {
                    sample: recipientsWithContact.slice(0, parseInt(limit)),
                    totalWithContact: recipientsWithContact.length,
                    totalAll: result.pagination.total,
                },
            });
        } catch (error) {
            console.error('[WhatsApp] Error previewing recipients:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Get template categories
     */
    getCategories: async (req, res, db) => {
        try {
            const categories = [
                { value: 'maintenance', label: 'System Maintenance', labelLao: 'ແຈ້ງປິດປັບປຸງລະບົບ', icon: '⚠️' },
                { value: 'payment', label: 'Payment Reminder', labelLao: 'ແຈ້ງເຕືອນຊຳລະ', icon: '💳' },
                { value: 'update', label: 'App Update', labelLao: 'ອັບເດດແອັບ', icon: '🔄' },
                { value: 'emergency', label: 'Emergency', labelLao: 'ເຫດສຸກເສີນ', icon: '🆘' },
                { value: 'promotion', label: 'Promotion', labelLao: 'ໂປຣໂມຊັ່ນ', icon: '🎉' },
                { value: 'general', label: 'General', labelLao: 'ທົ່ວໄປ', icon: '📱' },
            ];

            res.json({
                success: true,
                data: categories,
            });
        } catch (error) {
            console.error('[WhatsApp] Error getting categories:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },

    /**
     * Test send to a single number
     */
    testSend: async (req, res, db) => {
        try {
            const { phoneNumber, message } = req.body;

            if (!phoneNumber || !message) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'phoneNumber and message are required' 
                });
            }

            const result = await sendWhatsAppMessage(phoneNumber, message);

            res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('[WhatsApp] Error in test send:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
};

/**
 * Send WhatsApp message via Twilio
 */
async function sendWhatsAppMessage(to, body) {
    const client = getTwilioClient();
    
    if (!client) {
        console.warn('[WhatsApp] Twilio not configured - simulating send');
        return {
            success: true,
            simulated: true,
            sid: `SIM_${Date.now()}`,
        };
    }

    try {
        // Format phone number for WhatsApp
        let formattedTo = to.replace(/\D/g, ''); // Remove non-digits
        if (!formattedTo.startsWith('856')) {
            // Assume Laos number if no country code
            if (formattedTo.startsWith('0')) {
                formattedTo = '856' + formattedTo.substring(1);
            } else if (formattedTo.startsWith('20')) {
                formattedTo = '856' + formattedTo;
            }
        }

        const message = await client.messages.create({
            body,
            from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
            to: `whatsapp:+${formattedTo}`,
        });

        return {
            success: true,
            sid: message.sid,
            status: message.status,
        };
    } catch (error) {
        console.error('[WhatsApp] Twilio error:', error.message);
        throw error;
    }
}

/**
 * Background function to send broadcast messages
 */
async function sendBroadcastMessages(db, broadcastId) {
    console.log(`[WhatsApp] Starting broadcast ${broadcastId}`);
    
    const broadcast = await db.collection('whatsappBroadcasts').findOne({ 
        _id: new ObjectId(broadcastId) 
    });

    if (!broadcast || broadcast.status === 'cancelled') {
        console.log('[WhatsApp] Broadcast cancelled or not found');
        return;
    }

    const pendingRecipients = broadcast.recipients.filter(r => r.status === 'pending');
    console.log(`[WhatsApp] Sending to ${pendingRecipients.length} recipients`);

    let sent = broadcast.stats.sent;
    let failed = broadcast.stats.failed;

    for (const recipient of pendingRecipients) {
        // Check if broadcast was cancelled
        const current = await db.collection('whatsappBroadcasts').findOne({ 
            _id: new ObjectId(broadcastId) 
        });
        if (current.status === 'cancelled') {
            console.log('[WhatsApp] Broadcast cancelled, stopping');
            break;
        }

        const phoneNumber = recipient.whatsapp || recipient.phone;
        if (!phoneNumber) {
            failed++;
            await updateRecipientStatus(db, broadcastId, recipient.restaurantId, 'failed', 'No phone number');
            continue;
        }

        try {
            const result = await sendWhatsAppMessage(phoneNumber, broadcast.message);
            sent++;
            await updateRecipientStatus(db, broadcastId, recipient.restaurantId, 'sent', null, result.sid);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failed++;
            await updateRecipientStatus(db, broadcastId, recipient.restaurantId, 'failed', error.message);
        }

        // Update stats periodically
        if ((sent + failed) % 10 === 0) {
            await db.collection('whatsappBroadcasts').updateOne(
                { _id: new ObjectId(broadcastId) },
                { $set: { 'stats.sent': sent, 'stats.failed': failed, updatedAt: new Date() } }
            );
        }
    }

    // Final update
    await db.collection('whatsappBroadcasts').updateOne(
        { _id: new ObjectId(broadcastId) },
        { 
            $set: { 
                'stats.sent': sent,
                'stats.failed': failed,
                status: 'completed',
                completedAt: new Date(),
                updatedAt: new Date(),
            }
        }
    );

    console.log(`[WhatsApp] Broadcast ${broadcastId} completed: ${sent} sent, ${failed} failed`);
}

/**
 * Update recipient status in broadcast
 */
async function updateRecipientStatus(db, broadcastId, restaurantId, status, error, messageSid) {
    await db.collection('whatsappBroadcasts').updateOne(
        { 
            _id: new ObjectId(broadcastId),
            'recipients.restaurantId': restaurantId
        },
        { 
            $set: { 
                'recipients.$.status': status,
                'recipients.$.error': error,
                'recipients.$.messageSid': messageSid,
                'recipients.$.sentAt': status === 'sent' ? new Date() : null,
            }
        }
    );
}

module.exports = whatsappController;
