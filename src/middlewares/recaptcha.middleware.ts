import { Request, Response, NextFunction } from 'express';
import { settingsService, SETTINGS_KEYS } from '../modules/admin/settings.service';

/**
 * reCAPTCHA v2 verification middleware.
 * Reads configuration from SystemSetting DB table.
 * If reCAPTCHA is disabled in admin panel, it skips verification.
 * Expects `recaptchaToken` in the request body.
 */
export const verifyRecaptcha = (minScore = 0.5) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Check if reCAPTCHA is enabled in admin settings
            const isEnabled = await settingsService.isRecaptchaEnabled();
            if (!isEnabled) {
                return next();
            }

            const secretKey = await settingsService.get(SETTINGS_KEYS.RECAPTCHA_SECRET_KEY);
            if (!secretKey) {
                console.log('[reCAPTCHA] Skipping — no secret key configured in settings');
                return next();
            }

            const recaptchaToken = req.body?.recaptchaToken;

            if (!recaptchaToken) {
                res.status(400).json({
                    success: false,
                    error: { message: 'Thiếu reCAPTCHA token. Vui lòng thử lại.', code: 'RECAPTCHA_MISSING' }
                });
                return;
            }

            const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
            const response = await fetch(verifyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    secret: secretKey,
                    response: recaptchaToken,
                    remoteip: req.ip || '',
                }),
            });

            const data = await response.json() as any;

            if (!data.success) {
                console.warn('[reCAPTCHA] Verification failed:', data['error-codes']);
                res.status(400).json({
                    success: false,
                    error: { message: 'Xác thực reCAPTCHA thất bại. Vui lòng thử lại.', code: 'RECAPTCHA_FAILED' }
                });
                return;
            }

            // For reCAPTCHA v3 (score-based)
            if (data.score !== undefined && data.score < minScore) {
                console.warn(`[reCAPTCHA] Low score: ${data.score} (min: ${minScore})`);
                res.status(403).json({
                    success: false,
                    error: { message: 'Phát hiện hành vi đáng ngờ. Vui lòng thử lại.', code: 'RECAPTCHA_LOW_SCORE' }
                });
                return;
            }

            // Attach reCAPTCHA data to request for logging
            (req as any).recaptcha = {
                score: data.score,
                action: data.action,
                hostname: data.hostname,
            };

            next();
        } catch (err) {
            console.error('[reCAPTCHA] Verification error:', err);
            // Don't block login on reCAPTCHA service errors
            next();
        }
    };
};
