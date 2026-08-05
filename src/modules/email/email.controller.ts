import { Request, Response } from 'express';
import prisma from '../../infra/prisma';
import expressAsyncHandler from 'express-async-handler';
import type { Prisma } from '@prisma/client';
import {
    maskEmailTransportConfig,
    mergeProtectedEmailTransportConfig,
    protectEmailTransportConfig,
} from './email-account-secrets';
import { smtpService } from './smtp.service';

export const emailController = {
    list: expressAsyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const accounts = await prisma.emailAccount.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
        });
        // Mask passwords in smtp/imap JSON
        const masked = accounts.map(a => {
            const result = { ...a } as any;
            result.smtp = maskEmailTransportConfig(result.smtp);
            result.imap = maskEmailTransportConfig(result.imap);
            return result;
        });
        res.json({ success: true, data: masked });
    }),

    getById: expressAsyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const accountId = req.params.accountId as string;
        const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
        if (!account) { res.status(404).json({ success: false, message: 'Email account không tồn tại' }); return; }
        if (account.workspaceId !== workspaceId) { res.status(403).json({ success: false, message: 'Không có quyền' }); return; }
        const result = { ...account } as any;
        result.smtp = maskEmailTransportConfig(result.smtp);
        result.imap = maskEmailTransportConfig(result.imap);
        res.json({ success: true, data: result });
    }),

    create: expressAsyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const userId = (req as any).user?.id;
        const { email, displayName, smtp, imap, allowReceive, allowSend, ticketType } = req.body;

        if (!email?.trim()) { res.status(400).json({ success: false, message: 'Cần nhập email' }); return; }

        const account = await prisma.emailAccount.create({
            data: {
                workspaceId,
                email: email.trim(),
                displayName: displayName || '',
                smtp: protectEmailTransportConfig(smtp) as Prisma.InputJsonObject,
                imap: protectEmailTransportConfig(imap) as Prisma.InputJsonObject,
                allowReceive: allowReceive !== false,
                allowSend: allowSend !== false,
                ticketType: ticketType || 'support',
                createdById: userId,
            },
        });

        const result = { ...account } as any;
        result.smtp = maskEmailTransportConfig(result.smtp);
        result.imap = maskEmailTransportConfig(result.imap);
        res.status(201).json({ success: true, data: result });
    }),

    update: expressAsyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const accountId = req.params.accountId as string;
        const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
        if (!account) { res.status(404).json({ success: false, message: 'Email account không tồn tại' }); return; }
        if (account.workspaceId !== workspaceId) { res.status(403).json({ success: false, message: 'Không có quyền' }); return; }

        const { displayName, smtp, imap, isActive, allowReceive, allowSend, ticketType } = req.body;
        const data: any = {};
        if (displayName !== undefined) data.displayName = displayName;
        if (smtp !== undefined) {
            data.smtp = mergeProtectedEmailTransportConfig(account.smtp, smtp);
        }
        if (imap !== undefined) {
            data.imap = mergeProtectedEmailTransportConfig(account.imap, imap);
        }
        if (isActive !== undefined) data.isActive = isActive;
        if (allowReceive !== undefined) data.allowReceive = allowReceive;
        if (allowSend !== undefined) data.allowSend = allowSend;
        if (ticketType !== undefined) data.ticketType = ticketType;

        const updated = await prisma.emailAccount.update({ where: { id: accountId }, data });
        const result = { ...updated } as any;
        result.smtp = maskEmailTransportConfig(result.smtp);
        result.imap = maskEmailTransportConfig(result.imap);
        res.json({ success: true, data: result });
    }),

    remove: expressAsyncHandler(async (req: Request, res: Response) => {
        const workspaceId = req.params.workspaceId as string;
        const accountId = req.params.accountId as string;
        const account = await prisma.emailAccount.findUnique({ where: { id: accountId } });
        if (!account) { res.status(404).json({ success: false, message: 'Email account không tồn tại' }); return; }
        if (account.workspaceId !== workspaceId) { res.status(403).json({ success: false, message: 'Không có quyền' }); return; }
        await prisma.emailAccount.delete({ where: { id: accountId } });
        res.json({ success: true, message: 'Đã xóa email account' });
    }),

    testSmtp: expressAsyncHandler(async (req: Request, res: Response) => {
        const { smtp, email, displayName } = req.body;
        const result = await smtpService.testConnection({ enabled: true, ...(smtp || {}), fromEmail: email, fromName: displayName });
        res.json({ success: true, data: result });
    }),
};
