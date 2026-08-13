import prisma from '../../infra/prisma';
import { decryptSecret, encryptSecret } from '../../infra/secretVault';

const INTERNAL_SETTING_PREFIXES = ['notification_outbox:'];

// In-memory cache for settings (avoid hitting DB on every request)
let settingsCache: Record<string, string> = {};
let lastCacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * System settings keys
 */
export const SETTINGS_KEYS = {
    // reCAPTCHA
    RECAPTCHA_ENABLED: 'recaptcha_enabled',          // 'true' | 'false'
    RECAPTCHA_SITE_KEY: 'recaptcha_site_key',
    RECAPTCHA_SECRET_KEY: 'recaptcha_secret_key',

    // Google OAuth
    GOOGLE_AUTH_ENABLED: 'google_auth_enabled',       // 'true' | 'false'
    GOOGLE_CLIENT_ID: 'google_client_id',
    GOOGLE_CLIENT_SECRET: 'google_client_secret',
    GOOGLE_CALLBACK_URL: 'google_callback_url',

    // Facebook Fanpage (system OAuth app shared by all workspaces)
    FACEBOOK_ENABLED: 'facebook_enabled',
    FACEBOOK_APP_ID: 'facebook_app_id',
    FACEBOOK_APP_SECRET: 'facebook_app_secret',
    FACEBOOK_VERIFY_TOKEN: 'facebook_verify_token',
    FACEBOOK_REDIRECT_URI: 'facebook_redirect_uri',

    // Zalo personal connector (QR login through zca-js, not official Zalo OA)
    ZALO_PERSONAL_ENABLED: 'zalo_personal_enabled',
    ZALO_AUTO_RECONNECT: 'zalo_auto_reconnect',
    ZALO_CONNECTOR_NOTICE_ACCEPTED: 'zalo_connector_notice_accepted',

    // AI gateway
    AI_PROVIDER: 'ai_provider',
    AI_OPENAI_API_KEY: 'ai_openai_api_key',
    AI_OPENAI_MODEL: 'ai_openai_model',
    AI_OLLAMA_BASE_URL: 'ai_ollama_base_url',
    AI_OLLAMA_MODEL: 'ai_ollama_model',
    AI_OLLAMA_API_KEY: 'ai_ollama_api_key',
    AI_GATEWAY_TOKEN: 'ai_gateway_token',

    // Telegram admin notifications
    TELEGRAM_NOTIFICATIONS_ENABLED: 'telegram_notifications_enabled',
    // Canonical keys used by the admin UI. Legacy keys above remain readable
    // so existing installations can migrate without losing notifications.
    TELEGRAM_ENABLED: 'telegram_enabled',
    TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
    TELEGRAM_CHAT_ID: 'telegram_chat_id',
    TELEGRAM_API_TIMEOUT_MS: 'telegram_api_timeout_ms',
    TELEGRAM_NOTIFY_NEW_USER: 'telegram_notify_new_user',
    TELEGRAM_NOTIFY_NEW_WORKSPACE: 'telegram_notify_new_workspace',
    TELEGRAM_NOTIFY_PAYMENT: 'telegram_notify_payment',
    TELEGRAM_NOTIFY_SYSTEM_ERROR: 'telegram_notify_system_error',

    // Payment bank
    PAYMENT_BANK_ID: 'payment_bank_id',
    PAYMENT_BANK_NAME: 'payment_bank_name',
    PAYMENT_BANK_ACCOUNT_NUMBER: 'payment_bank_account_number',
    PAYMENT_BANK_ACCOUNT_NAME: 'payment_bank_account_name',
    PAYMENT_BANK_API_URL: 'payment_bank_api_url',
    PAYMENT_BANK_API_TOKEN: 'payment_bank_api_token',

    // System transactional email
    SMTP_ENABLED: 'smtp_enabled',
    SMTP_HOST: 'smtp_host',
    SMTP_PORT: 'smtp_port',
    SMTP_SECURE: 'smtp_secure',
    SMTP_REQUIRE_TLS: 'smtp_require_tls',
    SMTP_USER: 'smtp_user',
    SMTP_USERNAME: 'smtp_username',
    SMTP_PASSWORD: 'smtp_password',
    SMTP_FROM_EMAIL: 'smtp_from_email',
    SMTP_FROM_NAME: 'smtp_from_name',
    SMTP_CONNECTION_TIMEOUT_MS: 'smtp_connection_timeout_ms',
    SMTP_COMMAND_TIMEOUT_MS: 'smtp_command_timeout_ms',
    SMTP_TLS_REJECT_UNAUTHORIZED: 'smtp_tls_reject_unauthorized',

    // Super admin support widget used by landing/admin/customer support
    SYSTEM_SUPPORT_WIDGET_ENABLED: 'system_support_widget_enabled',
    SYSTEM_SUPPORT_WORKSPACE_ID: 'system_support_workspace_id',
    SYSTEM_SUPPORT_WIDGET_ID: 'system_support_widget_id',
    SYSTEM_SUPPORT_WIDGET_API_BASE: 'system_support_widget_api_base',
} as const;

export const settingsService = {
    /**
     * Get all settings as a key-value map
     */
    async getAll(): Promise<Record<string, string>> {
        const now = Date.now();
        if (now - lastCacheTime < CACHE_TTL && Object.keys(settingsCache).length > 0) {
            return settingsCache;
        }

        const rows = await prisma.systemSetting.findMany();
        const map: Record<string, string> = {};
        for (const row of rows) {
            if (INTERNAL_SETTING_PREFIXES.some(prefix => row.key.startsWith(prefix))) continue;
            map[row.key] = row.value;
        }
        settingsCache = map;
        lastCacheTime = now;
        return map;
    },

    /**
     * Get a single setting value
     */
    async get(key: string, fallback = ''): Promise<string> {
        const all = await this.getAll();
        return all[key] ?? fallback;
    },

    /**
     * Set a single setting
     */
    async set(key: string, value: string): Promise<void> {
        await prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
        // Invalidate cache
        settingsCache[key] = value;
    },

    /**
     * Set multiple settings at once
     */
    async setMany(entries: Record<string, string>): Promise<void> {
        const ops = Object.entries(entries).map(([key, value]) =>
            prisma.systemSetting.upsert({
                where: { key },
                update: { value },
                create: { key, value },
            })
        );
        await prisma.$transaction(ops);
        // Invalidate cache
        for (const [key, value] of Object.entries(entries)) {
            settingsCache[key] = value;
        }
    },

    /**
     * Read an encrypted setting. Legacy plaintext values remain readable so
     * credentials can be migrated without an outage.
     */
    async getSecret(key: string, fallback = ''): Promise<string> {
        const value = await this.get(key, '');
        return value ? decryptSecret(value) : fallback;
    },

    /**
     * Encrypt selected credential values before they reach the settings table.
     */
    async setManySecure(entries: Record<string, string>, secretKeys: ReadonlySet<string>): Promise<void> {
        const protectedEntries = Object.fromEntries(
            Object.entries(entries).map(([key, value]) => [
                key,
                secretKeys.has(key) && value ? encryptSecret(value) : value,
            ]),
        );
        await this.setMany(protectedEntries);
    },

    /**
     * Check if reCAPTCHA is enabled
     */
    async isRecaptchaEnabled(): Promise<boolean> {
        const val = await this.get(SETTINGS_KEYS.RECAPTCHA_ENABLED, 'false');
        return val === 'true';
    },

    /**
     * Check if Google OAuth is enabled
     */
    async isGoogleAuthEnabled(): Promise<boolean> {
        const val = await this.get(SETTINGS_KEYS.GOOGLE_AUTH_ENABLED, 'true');
        return val === 'true';
    },

    /**
     * Invalidate the cache
     */
    invalidateCache(): void {
        settingsCache = {};
        lastCacheTime = 0;
    },
};
