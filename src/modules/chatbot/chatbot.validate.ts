import Joi from 'joi';

const channelSchema = Joi.object({
    enabled: Joi.boolean().required(),
    filterIds: Joi.array().items(Joi.string().trim().max(160)).max(100),
});

const personaSchema = Joi.object({
    humanLikeMode: Joi.boolean(),
    roleTitle: Joi.string().trim().min(1).max(80),
    selfReference: Joi.string().trim().min(1).max(24),
    customerReference: Joi.string().trim().min(1).max(24),
    toneInstructions: Joi.string().trim().allow('').max(1600),
    sampleReplies: Joi.string().allow('').max(5000),
    signaturePhrases: Joi.array().items(Joi.string().trim().min(1).max(120)).max(12),
    forbiddenPhrases: Joi.array().items(Joi.string().trim().min(1).max(120)).max(30),
    adaptToCustomerTone: Joi.boolean(),
    emojiLevel: Joi.string().valid('none', 'light', 'expressive'),
    salesStyle: Joi.string().valid('consultative', 'balanced', 'direct'),
    identityStyle: Joi.string().valid('role_first', 'transparent'),
    typingIndicator: Joi.boolean(),
    typingLabel: Joi.string().trim().min(1).max(40),
    responsePace: Joi.string().valid('instant', 'natural', 'thoughtful'),
    minDelayMs: Joi.number().integer().min(0).max(8000),
    maxDelayMs: Joi.number().integer().min(0).max(12000),
}).custom((value, helpers) => {
    if (
        typeof value.minDelayMs === 'number'
        && typeof value.maxDelayMs === 'number'
        && value.minDelayMs > value.maxDelayMs
    ) {
        return helpers.error('any.custom', {
            message: 'minDelayMs không được lớn hơn maxDelayMs',
        });
    }
    return value;
}).messages({
    'any.custom': '{{#message}}',
});

const botFields = {
    name: Joi.string().trim().min(1).max(100),
    avatarUrl: Joi.string().trim().allow('', null).max(2000),
    brandName: Joi.string().trim().allow('').max(120),
    brandDescription: Joi.string().trim().allow('').max(2000),
    aiModel: Joi.string().trim().allow('').max(160),
    mainTask: Joi.string().valid('customer_care', 'sales', 'technical_support'),
    conversationStyle: Joi.string().valid('friendly', 'professional', 'casual'),
    messageLength: Joi.string().valid('short', 'medium', 'long'),
    customGreeting: Joi.string().trim().allow('').max(1000),
    welcomeMessage: Joi.string().trim().allow('').max(1000),
    channels: Joi.object({
        website: channelSchema,
        messenger: channelSchema,
        facebook: channelSchema,
        zalo: channelSchema,
        instagram: channelSchema,
    }),
    agentCondition: Joi.string().valid(
        'always',
        'no_agent_online',
        'at_least_one_online',
        'no_condition',
    ),
    scenarios: Joi.array().items(Joi.object({
        trigger: Joi.string().trim().min(1).max(300).required(),
        triggerType: Joi.string().valid('keyword', 'contains', 'regex').required(),
        response: Joi.string().trim().min(1).max(4000).required(),
        action: Joi.string().trim().allow('').max(120),
        actionData: Joi.any(),
        priority: Joi.number().integer().min(-1000).max(1000).default(0),
    })).max(50),
    quickReplies: Joi.array().items(Joi.object({
        label: Joi.string().trim().min(1).max(100).required(),
        value: Joi.string().trim().min(1).max(1000).required(),
        icon: Joi.string().trim().allow('').max(100),
    })).max(30),
    followUp: Joi.object({
        enabled: Joi.boolean().required(),
        delaySeconds: Joi.number().integer().min(5).max(86400).required(),
        message: Joi.string().trim().allow('').max(1000).required(),
    }),
    personaConfig: personaSchema,
};

export const chatbotValidate = {
    create: Joi.object(botFields).min(1),
    update: Joi.object(botFields).min(1),
    toggle: Joi.object({
        isActive: Joi.boolean().required(),
    }),
    preview: Joi.object({
        message: Joi.string().trim().min(1).max(4000).required(),
        channel: Joi.string()
            .lowercase()
            .valid('website', 'web', 'facebook', 'messenger', 'zalo', 'instagram')
            .default('website'),
        botId: Joi.string().trim().max(160),
        context: Joi.string().trim().allow('').max(4000),
    }),
};
