import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import { env } from '../../config/env';
import { userRepo } from './repos/user.repo';
import { sessionRepo } from './repos/session.repo';
import { security } from '../../infra/security';
import { settingsService, SETTINGS_KEYS } from '../admin/settings.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Get Google OAuth credentials (from DB settings first, fallback to env)
 */
async function getGoogleConfig() {
    const all = await settingsService.getAll();
    return {
        clientId: all[SETTINGS_KEYS.GOOGLE_CLIENT_ID] || env.GOOGLE_CLIENT_ID,
        clientSecret: all[SETTINGS_KEYS.GOOGLE_CLIENT_SECRET] || env.GOOGLE_CLIENT_SECRET,
        callbackUrl: all[SETTINGS_KEYS.GOOGLE_CALLBACK_URL] || env.GOOGLE_CALLBACK_URL,
        enabled: (all[SETTINGS_KEYS.GOOGLE_AUTH_ENABLED] ?? 'true') === 'true',
    };
}

/**
 * Redirect user to Google consent screen
 */
export const googleRedirect = asyncHandler(async (req: Request, res: Response) => {
    const config = await getGoogleConfig();
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3010';

    if (!config.enabled) {
        res.redirect(`${frontendUrl}/auth/login?error=google_disabled`);
        return;
    }

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
    });

    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

/**
 * Handle Google OAuth callback
 * GET /api/google-auth?code=xxx
 */
export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.query;
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:3010';

    if (!code || typeof code !== 'string') {
        res.redirect(`${frontendUrl}/auth/login?error=google_no_code`);
        return;
    }

    try {
        const config = await getGoogleConfig();

        // 1. Exchange authorization code for tokens
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.callbackUrl,
                grant_type: 'authorization_code',
            }),
        });

        const tokenData = await tokenResponse.json() as any;

        if (!tokenData.access_token) {
            console.error('[GoogleAuth] Token exchange failed:', tokenData);
            res.redirect(`${frontendUrl}/auth/login?error=google_token_failed`);
            return;
        }

        // 2. Get user info from Google
        const userResponse = await fetch(GOOGLE_USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const googleUser = await userResponse.json() as any;

        if (!googleUser.email) {
            res.redirect(`${frontendUrl}/auth/login?error=google_no_email`);
            return;
        }

        // 3. Find or create user
        let user = await userRepo.findByEmail(googleUser.email);

        if (!user) {
            // Create new user via Google
            user = await userRepo.createUser({
                email: googleUser.email,
                passwordHash: '', // No password for Google users
                name: googleUser.name || googleUser.email.split('@')[0],
                avatarUrl: googleUser.picture || undefined,
                googleId: googleUser.id,
            });
        } else {
            // Link Google ID if not already linked
            if (!user.googleId && googleUser.id) {
                await userRepo.updateUser(user.id, {
                    googleId: googleUser.id,
                    avatarUrl: user.avatarUrl || googleUser.picture || undefined,
                });
            }
        }

        if (!user.isActive) {
            res.redirect(`${frontendUrl}/auth/login?error=account_disabled`);
            return;
        }

        // 4. Generate tokens (same as normal login flow)
        const accessToken = security.generateToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await sessionRepo.createSession({
            userId: user.id,
            refreshToken,
            ipAddress,
            userAgent,
            expiresAt,
        });

        // 5. Set refresh token cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // 6. Redirect to frontend with access token
        res.redirect(`${frontendUrl}/auth/login?google_token=${accessToken}`);
    } catch (err: any) {
        console.error('[GoogleAuth] Callback error:', err);
        res.redirect(`${frontendUrl}/auth/login?error=google_internal_error`);
    }
});
