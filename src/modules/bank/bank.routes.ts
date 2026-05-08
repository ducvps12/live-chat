import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';

const bankRouter = Router();

// MB Bank API configuration
const BANK_API_URL = 'https://api.sieuthicode.net/historyapimbbank/6ae3dfd7d46966bf99a733fb2af34ac2';
const BANK_ACCOUNT = {
    number: '070028386',
    holder: 'PHAM TRONG DUONG',
    bank: 'MB Bank',
};

// Get bank transaction history
bankRouter.get('/transactions', requireAuth, async (req: Request, res: Response) => {
    try {
        const response = await fetch(BANK_API_URL);
        const data = await response.json();

        if (data.status !== 'success') {
            return res.status(502).json({ success: false, error: 'Không thể kết nối API ngân hàng' });
        }

        const transactions = (data.TranList || []).map((tx: any) => ({
            id: tx.refNo || tx.tranId,
            refNo: tx.refNo,
            tranId: tx.tranId,
            postingDate: tx.postingDate,
            transactionDate: tx.transactionDate,
            accountNo: tx.accountNo,
            creditAmount: parseInt(tx.creditAmount) || 0,
            debitAmount: parseInt(tx.debitAmount) || 0,
            currency: tx.currency || 'VND',
            description: tx.description || '',
            addDescription: tx.addDescription || '',
            availableBalance: parseInt(tx.availableBalance) || 0,
            transactionType: tx.transactionType,
            type: parseInt(tx.creditAmount) > 0 ? 'credit' : 'debit',
        }));

        // Calculate summary
        const totalCredit = transactions.reduce((sum: number, tx: any) => sum + tx.creditAmount, 0);
        const totalDebit = transactions.reduce((sum: number, tx: any) => sum + tx.debitAmount, 0);
        const balance = transactions.length > 0 ? transactions[0].availableBalance : 0;

        res.json({
            success: true,
            data: {
                account: BANK_ACCOUNT,
                balance,
                totalCredit,
                totalDebit,
                transactionCount: transactions.length,
                transactions,
            }
        });
    } catch (error: any) {
        console.error('[Bank API] Error:', error.message);
        res.status(500).json({ success: false, error: 'Lỗi kết nối API ngân hàng: ' + error.message });
    }
});

// Get account info only
bankRouter.get('/account', requireAuth, async (_req: Request, res: Response) => {
    try {
        const response = await fetch(BANK_API_URL);
        const data = await response.json();
        const balance = data.TranList?.[0]?.availableBalance || 0;

        res.json({
            success: true,
            data: {
                ...BANK_ACCOUNT,
                balance: parseInt(balance),
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default bankRouter;
