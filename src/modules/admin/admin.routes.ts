import { Router, Request, Response } from 'express';
import { adminController } from './admin.controller';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware';
import { paymentService } from '../subscription/payment.service';
import { env } from '../../config/env';

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/overview', adminController.overview);
router.get('/workspaces', adminController.listWorkspaces);
router.get('/users', adminController.listUsers);
router.get('/users/:userId', adminController.getUser);
router.patch('/users/:userId', adminController.updateUser);
router.post('/users/:userId/revoke-sessions', adminController.revokeSessions);
router.delete('/users/:userId', adminController.deleteUser);
router.get('/bots', adminController.listBots);
router.patch('/bots/:botId/toggle', adminController.toggleBot);
router.get('/ai/health', adminController.aiHealth);
router.get('/messages/recent', adminController.recentMessages);
router.get('/collections', adminController.collections);
router.get('/deep-stats', adminController.deepStats);

// ── ACB Bank — NemarkChat Revenue (separate from MB Bank Auto Bank) ──
router.get('/acb-transactions', async (_req: Request, res: Response) => {
    try {
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
                    bank: 'ACB - Ngân hàng Á Châu',
                    number: env.ACB_ACCOUNT_NUMBER,
                    holder: env.ACB_ACCOUNT_NAME,
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
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Payment bank config (for frontend payment modals) ──
router.get('/payment-config', async (_req: Request, res: Response) => {
    res.json({
        success: true,
        data: {
            bank: 'ACB',
            bankName: 'ACB - Ngân hàng Á Châu',
            number: env.ACB_ACCOUNT_NUMBER,
            holder: env.ACB_ACCOUNT_NAME,
        },
    });
});

// ── System Settings (reCAPTCHA, Google OAuth, etc.) ──
import { settingsService } from './settings.service';

router.get('/settings', async (_req: Request, res: Response) => {
    try {
        const all = await settingsService.getAll();
        res.json({ success: true, data: all });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/settings', async (req: Request, res: Response) => {
    try {
        const entries = req.body;
        if (!entries || typeof entries !== 'object') {
            res.status(400).json({ success: false, error: 'Body must be a key-value object' });
            return;
        }
        await settingsService.setMany(entries);
        res.json({ success: true, message: 'Đã lưu cài đặt thành công' });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
