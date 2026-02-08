const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.local') });

const env = {
  app: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'default_secret_please_change_in_prod',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'livechat',
  },
  embed: {
    jwtSecret: process.env.EMBED_JWT_SECRET || process.env.JWT_SECRET || 'embed_secret_change_in_prod',
    tokenTTL: parseInt(process.env.EMBED_TOKEN_TTL_SECONDS, 10) || 86400,
    widgetCacheTTL: parseInt(process.env.EMBED_WIDGET_CACHE_SECONDS, 10) || 3600,
    devAllowAll: process.env.EMBED_DEV_ALLOW_ALL === 'true',
  },
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    fromName: process.env.EMAIL_FROM_NAME || 'Live Chat Support',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER,
  },
  urls: {
    backend: process.env.BACKEND_PUBLIC_URL || 'http://localhost:3001',
    frontend: process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3001',
  },
  googleDrive: {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  },
  workspace: {
    defaultInvitePassword: process.env.DEFAULT_INVITE_PASSWORD || 'WelcomeABC123@',
  },
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  FACEBOOK_WEBHOOK_VERIFY_TOKEN: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'default_verify_token',
};

module.exports = env;
