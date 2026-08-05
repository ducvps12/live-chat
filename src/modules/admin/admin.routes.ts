import { Router, Request, Response } from 'express';
import { adminController } from './admin.controller';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware';
import { paymentService } from '../subscription/payment.service';
import { SETTINGS_KEYS, settingsService } from './settings.service';
import { smtpService, type SmtpConfigInput } from '../email/smtp.service';
import {
    TelegramNotifierError,
    telegramNotifier,
    type TelegramConfigOverrides,
} from '../notification/telegram-notifier.service';
import { facebookService } from '../facebook/facebook.service';
import prisma from '../../infra/prisma';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/overview', adminController.overview);
router.get('/workspaces', adminController.listWorkspaces);
router.get('/workspaces/:workspaceId/widgets', adminController.listWorkspaceWidgets);
router.get('/users', adminController.listUsers);
router.get('/users/:userId', adminController.getUser);
router.patch('/users/:userId', adminController.updateUser);
router.put('/users/:userId/subscriptions/:workspaceId', adminController.upsertUserSubscription);
router.delete('/users/:userId/subscriptions/:workspaceId', adminController.deleteUserSubscription);
router.post('/users/:userId/revoke-sessions', adminController.revokeSessions);
router.delete('/users/:userId', adminController.deleteUser);
router.get('/bots', adminController.listBots);
router.patch('/bots/:botId/toggle', adminController.toggleBot);
router.get('/ai/health', adminController.aiHealth);
router.get('/messages/recent', adminController.recentMessages);
router.get('/collections', adminController.collections);
router.get('/deep-stats', adminController.deepStats);
router.get('/system-metrics', adminController.systemMetrics);

// ── ACB Bank — NemarkChat Revenue (separate from MB Bank Auto Bank) ──
router.get('/acb-transactions', async (_req: Request, res: Response) => {
    try {
        const config = await paymentService.getPaymentBankConfig();
        const transactions = await paymentService.fetchACBTransactions();
        const inTx = transactions.filter(t => t.type === 'IN');
        const totalRevenue = inTx.reduce((sum, t) => sum + t.amount, 0);

        // Monthly revenue
        const now = new Date();
        const monthlyTx = inTx.filter(t => {
            const d = new Date(t.postingDate);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const monthlyRevenue = monthlyTx.reduce((sum, t) => sum + t.amount, 0);

        res.json({
            success: true,
            data: {
                account: {
                    bank: config.bankName,
                    number: config.accountNumber,
                    holder: config.accountName,
                },
                totalRevenue,
                monthlyRevenue,
                transactionCount: inTx.length,
                monthlyCount: monthlyTx.length,
                transactions: inTx.map(t => ({
                    amount: t.amount,
                    description: t.description,
                    postingDate: t.postingDate,
                    senderName: t.senderName || '',
                })),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load transactions';
        res.status(500).json({ success: false, error: message });
    }
});

// ── Payment bank config (for frontend payment modals) ──
router.get('/payment-config', async (_req: Request, res: Response) => {
    const config = await paymentService.getPaymentBankConfig();
    res.json({
        success: true,
        data: {
            bank: config.bankId,
            bankName: config.bankName,
            number: config.accountNumber,
            holder: config.accountName,
            apiUrl: config.apiUrl,
            apiToken: config.apiToken ? `${config.apiToken.slice(0, 6)}••••${config.apiToken.slice(-4)}` : '',
        },
    });
});

router.put('/payment-config', async (req: Request, res: Response) => {
    const { bank = 'ACB', bankName = '', number = '', holder = '', apiUrl = '', apiToken = '' } = req.body || {};

    if (!number || !holder || !bankName) {
        res.status(400).json({ success: false, error: 'Thiếu thông tin ngân hàng, số tài khoản hoặc chủ tài khoản' });
        return;
    }

    const payload: Record<string, string> = {
        [SETTINGS_KEYS.PAYMENT_BANK_ID]: String(bank).trim(),
        [SETTINGS_KEYS.PAYMENT_BANK_NAME]: String(bankName).trim(),
        [SETTINGS_KEYS.PAYMENT_BANK_ACCOUNT_NUMBER]: String(number).trim(),
        [SETTINGS_KEYS.PAYMENT_BANK_ACCOUNT_NAME]: String(holder).trim(),
        [SETTINGS_KEYS.PAYMENT_BANK_API_URL]: String(apiUrl || '').trim(),
    };

    if (apiToken && !String(apiToken).includes('••••')) {
        payload[SETTINGS_KEYS.PAYMENT_BANK_API_TOKEN] = String(apiToken).trim();
    }

    await settingsService.setMany(payload);
    settingsService.invalidateCache();
    const config = await paymentService.getPaymentBankConfig();

    res.json({
        success: true,
        message: 'Đã lưu cấu hình tài khoản nhận thanh toán',
        data: {
            bank: config.bankId,
            bankName: config.bankName,
            number: config.accountNumber,
            holder: config.accountName,
            apiUrl: config.apiUrl,
            apiToken: config.apiToken ? `${config.apiToken.slice(0, 6)}••••${config.apiToken.slice(-4)}` : '',
        },
    });
});

// ── System Settings (reCAPTCHA, Google OAuth, AI gateway, etc.) ──
const ALLOWED_SETTING_KEYS = new Set<string>(Object.values(SETTINGS_KEYS));
const SENSITIVE_SETTING_KEYS = new Set<string>([
    SETTINGS_KEYS.RECAPTCHA_SECRET_KEY,
    SETTINGS_KEYS.GOOGLE_CLIENT_SECRET,
    SETTINGS_KEYS.AI_OPENAI_API_KEY,
    SETTINGS_KEYS.AI_OLLAMA_API_KEY,
    SETTINGS_KEYS.AI_GATEWAY_TOKEN,
    SETTINGS_KEYS.PAYMENT_BANK_API_TOKEN,
    SETTINGS_KEYS.SMTP_PASSWORD,
    SETTINGS_KEYS.TELEGRAM_BOT_TOKEN,
    SETTINGS_KEYS.FACEBOOK_APP_SECRET,
    SETTINGS_KEYS.FACEBOOK_VERIFY_TOKEN,
]);
// SMTP and Telegram are migrated to the encrypted settings vault.
// Other legacy credentials still have consumers that read them as plain settings.
const ENCRYPTED_SETTING_KEYS = new Set<string>([
    SETTINGS_KEYS.SMTP_PASSWORD,
    SETTINGS_KEYS.TELEGRAM_BOT_TOKEN,
    SETTINGS_KEYS.FACEBOOK_APP_SECRET,
    SETTINGS_KEYS.FACEBOOK_VERIFY_TOKEN,
]);

const maskSecret = (value: string) => value
    ? `••••••••${value.slice(-4)}`
    : '';

const isMaskedSecret = (value: string) => value.includes('••••') || /^\*{4,}/.test(value);

router.get('/settings/smtp', async (_req: Request, res: Response) => {
    try {
        res.json({ success: true, data: await smtpService.getPublicConfig() });
    } catch (error) {
        const safe = smtpService.safeError(error);
        res.status(500).json({ success: false, error: safe.message, code: safe.code });
    }
});

router.post('/settings/smtp/test', async (req: Request, res: Response) => {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const config = payload.config && typeof payload.config === 'object'
        ? payload.config as SmtpConfigInput
        : payload as SmtpConfigInput;
    const mode = payload.mode === 'send' ? 'send' : 'connection';

    try {
        if (mode === 'send') {
            const recipientValue = typeof payload.recipient === 'string'
                ? payload.recipient
                : payload.to;
            const recipient = typeof recipientValue === 'string' ? recipientValue.trim() : '';
            const result = await smtpService.sendTestEmail(recipient, config);
            res.json({
                success: true,
                data: {
                    ok: true,
                    accepted: result.accepted,
                    messageId: result.messageId,
                },
            });
            return;
        }

        const result = await smtpService.testConnection(config);
        res.json({
            success: true,
            data: { ...result, latency: result.latencyMs },
        });
    } catch (error) {
        const safe = smtpService.safeError(error);
        const status = ['SMTP_INVALID_CONFIG', 'SMTP_INVALID_ADDRESS', 'SMTP_NOT_CONFIGURED']
            .includes(safe.code)
            ? 400
            : 502;
        res.status(status).json({
            success: false,
            error: safe.message,
            code: safe.code,
            retryable: safe.retryable,
        });
    }
});

router.get('/settings', async (_req: Request, res: Response) => {
    try {
        const all = await settingsService.getAll();
        const normalizedSettings = {
            ...all,
            [SETTINGS_KEYS.SMTP_USERNAME]: all[SETTINGS_KEYS.SMTP_USERNAME]
                || all[SETTINGS_KEYS.SMTP_USER]
                || '',
            [SETTINGS_KEYS.TELEGRAM_ENABLED]: all[SETTINGS_KEYS.TELEGRAM_ENABLED]
                || all[SETTINGS_KEYS.TELEGRAM_NOTIFICATIONS_ENABLED]
                || '',
            [SETTINGS_KEYS.TELEGRAM_NOTIFY_NEW_WORKSPACE]: all[SETTINGS_KEYS.TELEGRAM_NOTIFY_NEW_WORKSPACE]
                || all[SETTINGS_KEYS.TELEGRAM_NOTIFY_NEW_USER]
                || '',
        };
        const safeSettings = Object.fromEntries(
            Object.entries(normalizedSettings).map(([key, value]) => [
                key,
                SENSITIVE_SETTING_KEYS.has(key) ? maskSecret(value) : value,
            ])
        );
        res.json({ success: true, data: safeSettings });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load settings';
        res.status(500).json({ success: false, error: message });
    }
});

router.put('/settings', async (req: Request, res: Response) => {
    try {
        const entries = req.body;
        if (!entries || typeof entries !== 'object') {
            res.status(400).json({ success: false, error: 'Body must be a key-value object' });
            return;
        }

        const safeEntries: Record<string, string> = {};
        for (const [key, rawValue] of Object.entries(entries)) {
            if (!ALLOWED_SETTING_KEYS.has(key)) continue;
            if (!['string', 'number', 'boolean'].includes(typeof rawValue)) continue;

            const value = String(rawValue).trim();
            if (value.length > 4096) {
                res.status(400).json({ success: false, error: `Giá trị ${key} vượt quá giới hạn` });
                return;
            }
            if (SENSITIVE_SETTING_KEYS.has(key) && (!value || isMaskedSecret(value))) continue;
            safeEntries[key] = value;
        }

        if (Object.keys(safeEntries).length === 0) {
            res.json({ success: true, message: 'Không có thay đổi cần lưu' });
            return;
        }

        await settingsService.setManySecure(safeEntries, ENCRYPTED_SETTING_KEYS);
        res.json({ success: true, message: 'Đã lưu cài đặt thành công' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save settings';
        res.status(500).json({ success: false, error: message });
    }
});

router.get('/settings/facebook/status', async (_req: Request, res: Response) => {
    const status = await facebookService.getConfigStatus();
    res.json({ success: true, data: status });
});

router.get('/settings/zalo/status', async (_req: Request, res: Response) => {
    const enabled = (await settingsService.get(SETTINGS_KEYS.ZALO_PERSONAL_ENABLED, 'true')) === 'true';
    const autoReconnect = (await settingsService.get(SETTINGS_KEYS.ZALO_AUTO_RECONNECT, 'true')) === 'true';
    const noticeAccepted = (await settingsService.get(SETTINGS_KEYS.ZALO_CONNECTOR_NOTICE_ACCEPTED, 'false')) === 'true';
    const [accounts, activeAccounts] = await Promise.all([
        prisma.zaloAccount.count(),
        prisma.zaloAccount.count({ where: { status: 'active' } }),
    ]);
    res.json({
        success: true,
        data: {
            connector: 'zca-js-personal-qr',
            officialApi: false,
            apiCredentialsRequired: false,
            enabled,
            autoReconnect,
            noticeAccepted,
            accounts,
            activeAccounts,
        },
    });
});

const telegramErrorStatus = (error: TelegramNotifierError): number => {
    if (error.code === 'TELEGRAM_TIMEOUT') return 504;
    if (error.status === 429) return 429;
    if (
        error.code === 'TELEGRAM_NOT_CONFIGURED'
        || error.code === 'TELEGRAM_INVALID_CONFIG'
        || error.code === 'TELEGRAM_INVALID_MESSAGE'
    ) return 400;
    return 502;
};

const sendTelegramError = (res: Response, error: unknown): void => {
    if (error instanceof TelegramNotifierError) {
        res.status(telegramErrorStatus(error)).json({
            success: false,
            error: error.message,
            code: error.code,
            retryable: error.retryable,
            ...(error.retryAfterSeconds !== undefined
                ? { retryAfterSeconds: error.retryAfterSeconds }
                : {}),
        });
        return;
    }

    res.status(500).json({
        success: false,
        error: 'Không thể xử lý yêu cầu Telegram lúc này',
        code: 'TELEGRAM_INTERNAL_ERROR',
        retryable: false,
    });
};

router.get('/settings/telegram', async (_req: Request, res: Response) => {
    try {
        res.json({ success: true, data: await telegramNotifier.status() });
    } catch (error: unknown) {
        sendTelegramError(res, error);
    }
});

router.post('/settings/telegram/discover', async (req: Request, res: Response) => {
    try {
        const config = req.body?.config && typeof req.body.config === 'object'
            ? req.body.config as TelegramConfigOverrides
            : undefined;
        const result = await telegramNotifier.discoverChats({
            offset: req.body?.offset,
            limit: req.body?.limit,
            config,
        });
        res.json({ success: true, data: result });
    } catch (error: unknown) {
        sendTelegramError(res, error);
    }
});

router.post('/settings/telegram/test', async (req: Request, res: Response) => {
    try {
        const config = req.body?.config && typeof req.body.config === 'object'
            ? req.body.config as TelegramConfigOverrides
            : undefined;
        const result = await telegramNotifier.sendTestMessage({
            config,
            chatId: config?.chatId ?? req.body?.chatId,
            message: typeof req.body?.message === 'string'
                ? req.body.message
                : undefined,
            disableNotification: req.body?.disableNotification === true,
        });
        res.json({ success: true, data: result });
    } catch (error: unknown) {
        sendTelegramError(res, error);
    }
});

export default router;
