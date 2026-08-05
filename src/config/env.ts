import dotenv from 'dotenv';
dotenv.config();

export const env = {
    PORT: process.env.SERVER_PORT || 4010,
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nemark_dev',
    JWT_SECRET: process.env.JWT_SECRET || '',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

    // Browser Pool (Remote Session)
    BROWSER_POOL_MAX: Number(process.env.BROWSER_POOL_MAX) || 5,
    BROWSER_HEADLESS: process.env.BROWSER_HEADLESS !== 'false',
    SCREENCAST_QUALITY: Number(process.env.SCREENCAST_QUALITY) || 60,
    SCREENCAST_FPS: Number(process.env.SCREENCAST_FPS) || 10,

    // ACB Bank Payment
    ACB_ACCOUNT_NUMBER: process.env.ACB_ACCOUNT_NUMBER || '',
    ACB_API_TOKEN: process.env.ACB_API_TOKEN || '',
    ACB_API_URL: process.env.ACB_API_URL || 'https://api.sieuthicode.net/historyapiacb',
    ACB_ACCOUNT_NAME: process.env.ACB_ACCOUNT_NAME || '',

    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost/api/google-auth',

    // reCAPTCHA v3
    RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',

    // Frontend URL
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3010',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_LANDING_WIDGET_API_BASE: process.env.NEXT_PUBLIC_LANDING_WIDGET_API_BASE || '',
};

export const validateProductionEnv = () => {
    if (process.env.NODE_ENV !== 'production') return;

    const errors: string[] = [];
    if (env.JWT_SECRET.length < 32) errors.push('JWT_SECRET must contain at least 32 characters');
    if (!process.env.MYSQL_DATABASE) errors.push('MYSQL_DATABASE is required');
    if (!process.env.MYSQL_USER) errors.push('MYSQL_USER is required');
    if (!env.FRONTEND_URL.startsWith('https://')) errors.push('FRONTEND_URL must use HTTPS in production');

    if (errors.length > 0) {
        throw new Error(`Invalid production environment: ${errors.join('; ')}`);
    }
};

export const corsOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) {
        callback(null, true);
        return;
    }

    const allowed = new Set([
        env.FRONTEND_URL.replace(/\/$/, ''),
        (process.env.BASE_URL || '').replace(/\/$/, ''),
        'https://nemarkchat.com',
        'https://www.nemarkchat.com',
    ].filter(Boolean));

    const normalizedOrigin = origin.replace(/\/$/, '');
    const isLocalDevelopment = process.env.NODE_ENV !== 'production'
        && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);

    if (allowed.has(normalizedOrigin) || isLocalDevelopment) {
        callback(null, true);
        return;
    }

    callback(new Error('Origin is not allowed by CORS'));
};
