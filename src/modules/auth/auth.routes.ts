import { Router } from 'express';
import { authController } from './auth.controller';
import { authValidate } from './auth.validate';
import { validateRequest } from '../../middlewares/validateRequest';
import { requireAuth } from '../../middlewares/auth.middleware';
import { verifyRecaptcha } from '../../middlewares/recaptcha.middleware';
import { googleRedirect, googleCallback } from './google-auth.controller';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';

const router = Router();

// Public routes
router.get('/public-config', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const settings = await settingsService.getAll();
        res.json({
            success: true,
            data: {
                recaptchaEnabled: settings[SETTINGS_KEYS.RECAPTCHA_ENABLED] === 'true',
                recaptchaSiteKey: settings[SETTINGS_KEYS.RECAPTCHA_SITE_KEY]
                    || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
                    || '',
                googleAuthEnabled: (settings[SETTINGS_KEYS.GOOGLE_AUTH_ENABLED] ?? 'true') === 'true',
            },
        });
    } catch (error) {
        console.warn('[Auth] Could not load public auth config:', error);
        res.json({
            success: true,
            data: {
                recaptchaEnabled: false,
                recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '',
                googleAuthEnabled: Boolean(process.env.GOOGLE_CLIENT_ID),
            },
        });
    }
});

router.post('/register', verifyRecaptcha(0.5), validateRequest(authValidate.register), authController.register);
router.post('/login', verifyRecaptcha(0.5), validateRequest(authValidate.login), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', verifyRecaptcha(0.5), validateRequest(authValidate.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validateRequest(authValidate.resetPassword), authController.resetPassword);

// Google OAuth routes
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

// Protected routes (Require Authentication)
router.get('/me', requireAuth, authController.me);
router.patch('/profile', requireAuth, validateRequest(authValidate.updateProfile), authController.updateProfile);
router.post('/change-password', requireAuth, validateRequest(authValidate.changePassword), authController.changePassword);

// Session Management
router.get('/sessions', requireAuth, authController.getSessions);
router.delete('/sessions', requireAuth, authController.revokeOtherSessions);

// One-time bootstrap only; service rejects this route after the first admin exists.
router.post('/setup-admin', verifyRecaptcha(0.5), validateRequest(authValidate.register), authController.setup);

export default router;

// Google OAuth callback — exported separately so it can be mounted at /api/google-auth
export { googleCallback };
