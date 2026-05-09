import prisma from '../../infra/prisma';

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
