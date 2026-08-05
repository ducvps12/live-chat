import axios from 'axios';
import { env } from '../../config/env';
import prisma from '../../infra/prisma';
import type { Invoice } from '@prisma/client';
import { PLAN_TIERS } from './subscription.service';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';

// ── ACB Transaction from sieuthicode API ──
interface ACBTransaction {
    amount: number;
    description: string;
    postingDate: number;
    type: 'IN' | 'OUT';
    accountName?: string;
    senderName?: string;
    receiverName?: string;
}

interface ACBApiResponse {
    messageStatus: string;
    data: ACBTransaction[];
}

export interface PaymentBankConfig {
    bankId: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    apiUrl: string;
    apiToken: string;
}

// ── Cache ──
let cachedTransactions: ACBTransaction[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

export class PaymentService {
    async getPaymentBankConfig(): Promise<PaymentBankConfig> {
        const all = await settingsService.getAll();
        return {
            bankId: all[SETTINGS_KEYS.PAYMENT_BANK_ID] || 'ACB',
            bankName: all[SETTINGS_KEYS.PAYMENT_BANK_NAME] || 'ACB - Ngân hàng Á Châu',
            accountNumber: all[SETTINGS_KEYS.PAYMENT_BANK_ACCOUNT_NUMBER] || env.ACB_ACCOUNT_NUMBER,
            accountName: all[SETTINGS_KEYS.PAYMENT_BANK_ACCOUNT_NAME] || env.ACB_ACCOUNT_NAME,
            apiUrl: all[SETTINGS_KEYS.PAYMENT_BANK_API_URL] || env.ACB_API_URL,
            apiToken: all[SETTINGS_KEYS.PAYMENT_BANK_API_TOKEN] || env.ACB_API_TOKEN,
        };
    }

    async fetchACBTransactions(): Promise<ACBTransaction[]> {
        const now = Date.now();
        if (cachedTransactions.length > 0 && (now - cacheTimestamp) < CACHE_TTL_MS) {
            return cachedTransactions;
        }
        try {
            const config = await this.getPaymentBankConfig();
            const url = `${config.apiUrl}/${config.apiToken}`;
            const response = await axios.get<ACBApiResponse>(url, { timeout: 10000 });
            if (response.data?.messageStatus === 'success' && Array.isArray(response.data.data)) {
                cachedTransactions = response.data.data;
                cacheTimestamp = now;
                return cachedTransactions;
            }
            console.warn('[PaymentService] API returned unexpected format:', response.data?.messageStatus);
            return cachedTransactions;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown payment API error';
            console.error('[PaymentService] Failed to fetch payment transactions:', message);
            return cachedTransactions;
        }
    }

    findMatchingTransaction(transactions: ACBTransaction[], transferContent: string, amount: number): ACBTransaction | null {
        const normalizedContent = transferContent.toUpperCase().replace(/[^A-Z0-9]/g, '');
        for (const tx of transactions) {
            if (tx.type !== 'IN') continue;
            if (tx.amount !== amount) continue;
            const normalizedDesc = (tx.description || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (normalizedDesc.includes(normalizedContent)) return tx;
        }
        return null;
    }

    generateTransferContent(invoiceNumber: string): string {
        return invoiceNumber.replace(/[^A-Z0-9]/gi, '');
    }

    async getPaymentInfo(invoiceId: string) {
        console.log('[PaymentService] getPaymentInfo called with invoiceId:', invoiceId);
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) {
            console.error('[PaymentService] Invoice not found for id:', invoiceId);
            return null;
        }
        console.log('[PaymentService] Invoice found:', invoice.invoiceNumber, 'amount:', invoice.amount);
        const transferContent = this.generateTransferContent(invoice.invoiceNumber);
        const config = await this.getPaymentBankConfig();
        return {
            bankId: config.bankId,
            bankName: config.bankName,
            accountNumber: config.accountNumber,
            accountName: config.accountName,
            amount: invoice.amount,
            transferContent,
            invoiceNumber: invoice.invoiceNumber,
            currency: invoice.currency || 'VND',
        };
    }

    async checkPayment(invoiceId: string): Promise<{ found: boolean; invoice: Invoice | null; transaction?: ACBTransaction }> {
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) return { found: false, invoice: null };
        if (invoice.status === 'paid') return { found: true, invoice };

        const transferContent = this.generateTransferContent(invoice.invoiceNumber);
        const transactions = await this.fetchACBTransactions();
        const match = this.findMatchingTransaction(transactions, transferContent, invoice.amount);

        if (match) {
            const updatedInvoice = await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'paid',
                    paidAt: new Date(match.postingDate || Date.now()),
                    paymentMethod: 'bank_transfer',
                    paymentReference: `BANK-${match.postingDate}-${match.amount}`,
                },
            });

            const cycle = updatedInvoice.billingCycle === 'yearly' ? 'yearly' : 'monthly';
            await this.activateSubscription(updatedInvoice.workspaceId, updatedInvoice.planId, cycle);
            return { found: true, invoice: updatedInvoice, transaction: match };
        }

        return { found: false, invoice };
    }

    private async activateSubscription(workspaceId: string, planId: string, billingCycle: 'monthly' | 'yearly'): Promise<void> {
        const plan = PLAN_TIERS.find(p => p.id === planId);
        if (!plan) return;

        const now = new Date();
        const periodEnd = billingCycle === 'yearly'
            ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await prisma.subscription.upsert({
            where: { workspaceId },
            create: {
                workspaceId, planId, status: 'active',
                currentPeriodStart: now, currentPeriodEnd: periodEnd, billingCycle,
            },
            update: {
                planId, status: 'active',
                currentPeriodStart: now, currentPeriodEnd: periodEnd, billingCycle, cancelledAt: null,
            },
        });

        console.log(`[PaymentService] Subscription activated: workspace=${workspaceId}, plan=${planId}, until=${periodEnd.toISOString()}`);
    }
}

export const paymentService = new PaymentService();
