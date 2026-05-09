import { Router } from 'express';
import { authController } from './auth.controller';
import { authValidate } from './auth.validate';
import { validateRequest } from '../../middlewares/validateRequest';
import { requireAuth } from '../../middlewares/auth.middleware';
import { verifyRecaptcha } from '../../middlewares/recaptcha.middleware';
import { googleRedirect, googleCallback } from './google-auth.controller';

const router = Router();

// Public routes
router.post('/login', verifyRecaptcha(0.5), validateRequest(authValidate.login), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', verifyRecaptcha(0.5), validateRequest(authValidate.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validateRequest(authValidate.resetPassword), authController.resetPassword);

// Google OAuth routes
router.get('/google', googleRedirect);

// Protected routes (Require Authentication)
router.get('/me', requireAuth, authController.me);
router.patch('/profile', requireAuth, validateRequest(authValidate.updateProfile), authController.updateProfile);
router.post('/change-password', requireAuth, validateRequest(authValidate.changePassword), authController.changePassword);

// Session Management
router.get('/sessions', requireAuth, authController.getSessions);
router.delete('/sessions', requireAuth, authController.revokeOtherSessions);

// Setup Admin (MVP only)
router.post('/setup-admin', verifyRecaptcha(0.5), validateRequest(authValidate.register), authController.setup);

export default router;

// Google OAuth callback — exported separately so it can be mounted at /api/google-auth
export { googleCallback };
