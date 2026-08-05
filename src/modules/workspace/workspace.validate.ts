import Joi from 'joi';

const preChatFieldSchema = Joi.object({
    key: Joi.string().required(),
    label: Joi.string().required(),
    type: Joi.string().valid('text', 'email', 'tel', 'textarea', 'select', 'checkbox'),
    required: Joi.boolean(),
    enabled: Joi.boolean(),
    placeholder: Joi.string().allow(''),
    options: Joi.array().items(Joi.string()).when('type', { is: 'select', then: Joi.required() }),
});

const configSchema = Joi.object({
    primaryColor: Joi.string(),
    gradient: Joi.string().allow(''),
    launcherStyle: Joi.string().valid('bubble', 'tab', 'pill', 'image').allow(''),
    launcherText: Joi.string().allow(''),
    launcherIcon: Joi.string().allow(''),
    tooltipText: Joi.string().allow(''),
    greeting: Joi.string(),
    placeholder: Joi.string(),
    position: Joi.string().valid('bottom-right', 'bottom-left', 'side-right', 'side-left'),
    language: Joi.string(),
    avatarUrl: Joi.string().uri().allow(''),
    showBranding: Joi.boolean(),
    brandingMode: Joi.string().valid('nemark', 'custom', 'hidden'),
    brandingName: Joi.string().trim().allow('').max(80),
    brandingUrl: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').max(500),
    themePreset: Joi.string().valid('modern', 'minimal', 'glass', 'compact'),
    customCss: Joi.string().allow('').max(12000),
    offlineMessage: Joi.string(),
    autoReply: Joi.string().allow(''),
    headerAvatar: Joi.string().uri().allow(''),
    profileDisplay: Joi.string().valid('company', 'agent'),
    showTypingIndicator: Joi.boolean(),
    requestRating: Joi.boolean(),
    autoOpen: Joi.object({
        mode: Joi.string().valid('none', 'immediate', '20s', '5min', 'custom'),
        customSeconds: Joi.number().min(0).max(86400),
    }),
    greetingPopup: Joi.object({
        enabled: Joi.boolean(),
        message: Joi.string().allow('').max(500),
        ctaText: Joi.string().allow('').max(100),
        delay: Joi.number().min(0).max(86400),
    }),
    urlRules: Joi.object({
        domains: Joi.array().items(Joi.object({
            type: Joi.string().valid('include', 'exclude').required(),
            value: Joi.string().trim().min(1).max(500).required(),
        })),
        paths: Joi.array().items(Joi.object({
            type: Joi.string().valid('include', 'exclude').required(),
            value: Joi.string().trim().min(1).max(500).required(),
        })),
    }),
    preChatForm: Joi.object({
        enabled: Joi.boolean(),
        title: Joi.string().allow(''),
        fields: Joi.array().items(preChatFieldSchema),
        marketingConsent: Joi.object({
            enabled: Joi.boolean(),
            text: Joi.string().allow('').max(1000),
        }),
    }),
});

export const workspaceValidate = {
    create: Joi.object({
        name: Joi.string().min(2).max(100).required(),
        slug: Joi.string().min(2).max(50).pattern(/^[a-z0-9-]+$/).required()
            .messages({ 'string.pattern.base': 'Slug chỉ chấp nhận chữ thường, số và dấu gạch ngang' }),
    }),

    update: Joi.object({
        name: Joi.string().min(2).max(100),
        logoUrl: Joi.string().allow('', null),
        settings: Joi.object({
            timezone: Joi.string(),
            language: Joi.string(),
            businessHours: Joi.object({
                enabled: Joi.boolean(),
                schedule: Joi.array().items(
                    Joi.object({ day: Joi.number().min(0).max(6), start: Joi.string(), end: Joi.string() })
                ),
                holidays: Joi.array().items(
                    Joi.object({ date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/), name: Joi.string().allow('') })
                ),
            }),
        }),
    }),

    addMember: Joi.object({
        email: Joi.string().email().required(),
        role: Joi.string().valid('admin', 'agent', 'member').default('member'),
    }),

    updateMemberRole: Joi.object({
        role: Joi.string().valid('admin', 'agent', 'member').required(),
    }),
};

export const widgetValidate = {
    create: Joi.object({
        name: Joi.string().min(1).max(100).required(),
        config: configSchema,
        domainRules: Joi.object({
            mode: Joi.string().valid('allowlist', 'blocklist'),
            domains: Joi.array().items(Joi.string()),
        }),
    }),

    update: Joi.object({
        name: Joi.string().min(1).max(100),
        config: configSchema,
        domainRules: Joi.object({
            mode: Joi.string().valid('allowlist', 'blocklist'),
            domains: Joi.array().items(Joi.string()),
        }),
    }),
};

export const offlineMessageValidate = {
    create: Joi.object({
        name: Joi.string().min(1).max(100).required(),
        email: Joi.string().email().required(),
        message: Joi.string().min(1).max(2000).required(),
        visitorId: Joi.string().required(),
        widgetId: Joi.string(),     // may come from body, ignored (taken from params)
        timestamp: Joi.string(),     // may come from body, ignored
    }),
};
