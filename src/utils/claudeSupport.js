/**
 * Claude AI helper for WhatsApp support intake.
 *
 * Classifies an inbound restaurant message (issue / question / greeting),
 * assigns category + priority, and answers how-to questions from the FAQ
 * knowledge base. Returns null when no ANTHROPIC_API_KEY is configured or
 * the call fails — callers must fall back to plain ticket creation.
 */

// Claude client initialization (lazy loaded, same pattern as Twilio)
let claudeClient = null;
function getClaudeClient() {
    if (!claudeClient && process.env.ANTHROPIC_API_KEY) {
        const Anthropic = require('@anthropic-ai/sdk');
        claudeClient = new Anthropic();
    }
    return claudeClient;
}

const CLASSIFY_SCHEMA = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: ['issue', 'question', 'greeting'],
            description: 'issue = a problem to fix; question = how-to question; greeting = greeting/thanks/small talk',
        },
        category: {
            type: 'string',
            enum: ['hardware', 'software', 'billing', 'network', 'question', 'other'],
        },
        priority: {
            type: 'string',
            enum: ['urgent', 'normal'],
            description: 'urgent only when the restaurant cannot sell right now (system down, cannot bill, printer dead during service)',
        },
        subject: {
            type: 'string',
            description: 'Short Lao summary of the message, max 10 words',
        },
        reply: {
            type: ['string', 'null'],
            description: 'Lao reply to send back, ONLY for questions clearly answered by the FAQ. null when not confident or not a question.',
        },
    },
    required: ['type', 'category', 'priority', 'subject', 'reply'],
    additionalProperties: false,
};

function buildSystemPrompt(faqs, style) {
    const faqBlock = faqs.length
        ? faqs.map((f, i) => `${i + 1}. ຖາມ: ${f.question}\n   ຕອບ: ${f.answer}`).join('\n')
        : '(ຍັງບໍ່ມີ FAQ)';

    const styleBlock = style && style.trim()
        ? `\n\nReply style instructions from the AppZap team (apply to every reply you write):\n${style.trim()}`
        : '';

    return `You are the WhatsApp support assistant for AppZap, a restaurant POS system used in Laos. Restaurants message this number about problems and questions, in Lao language.

Your job for each message:
1. Classify it: "issue" (something is broken and needs the support team), "question" (asking how to use the system), or "greeting" (hello/thanks/small talk with no request).
2. Pick a category and priority. Priority is "urgent" ONLY if the restaurant cannot sell right now.
3. Write a short Lao subject summarizing the message.
4. If it is a question that the FAQ below clearly answers, write a friendly reply in Lao based ONLY on the FAQ content. If the FAQ does not clearly cover it, set reply to null — NEVER guess or invent how the system works. For issues and greetings, reply is null.

FAQ knowledge base:
${faqBlock}${styleBlock}`;
}

/**
 * Classify an inbound message. Returns the parsed object or null on
 * missing key / API error / refusal (caller falls back to plain intake).
 */
async function classifyMessage({ text, restaurantName, faqs = [], style = '' }) {
    const client = getClaudeClient();
    if (!client) return null;

    try {
        const response = await client.messages.create({
            model: process.env.CLAUDE_SUPPORT_MODEL || 'claude-opus-4-8',
            max_tokens: 1024,
            system: [
                {
                    type: 'text',
                    text: buildSystemPrompt(faqs, style),
                    cache_control: { type: 'ephemeral' },
                },
            ],
            output_config: { format: { type: 'json_schema', schema: CLASSIFY_SCHEMA } },
            messages: [
                {
                    role: 'user',
                    content: `ຮ້ານ: ${restaurantName || 'ບໍ່ຮູ້ຈັກ'}\nຂໍ້ຄວາມ: ${text}`,
                },
            ],
        });

        if (response.stop_reason === 'refusal') return null;
        const block = response.content.find((b) => b.type === 'text');
        if (!block) return null;
        return JSON.parse(block.text);
    } catch (error) {
        console.error('[Support/Claude] classify failed:', error.message);
        return null;
    }
}

module.exports = { classifyMessage };
