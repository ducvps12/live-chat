import prisma from '../../infra/prisma';
import type { Lead, Prisma } from '@prisma/client';

type JsonRecord = Record<string, unknown>;

export interface WidgetLeadCaptureInput {
    workspaceId: string;
    widgetId: string;
    visitorId: string;
    conversationId: string;
    visitorInfo?: unknown;
    conversationMetadata?: unknown;
    messageContent?: string;
}

export interface NormalizedWidgetVisitorInfo {
    name: string;
    email: string;
    phone: string;
    avatar: string;
    marketingConsent: boolean;
    consentText: string;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const EMAIL_IN_TEXT_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Accept the formats visitors actually type in chat (0912 345 678,
// 0912.345.678, +84 (912) 345-678) and normalize them before storage.
const PHONE_IN_TEXT_RE = /(?:^|\D)((?:\+?84|0)(?:[\s.()-]*\d){8,10})(?=\D|$)/;

function record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : {};
}

function text(value: unknown, maxLength: number): string {
    return typeof value === 'string'
        ? value
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength)
        : '';
}

export function normalizeLeadEmail(value: unknown): string {
    const email = text(value, 320).toLowerCase();
    return EMAIL_RE.test(email) ? email : '';
}

export function normalizeLeadPhone(value: unknown): string {
    let phone = text(value, 32).replace(/[^\d+]/g, '');
    if (phone.startsWith('+84')) phone = `0${phone.slice(3)}`;
    else if (phone.startsWith('84') && phone.length >= 10) phone = `0${phone.slice(2)}`;
    phone = phone.replace(/\D/g, '');
    return /^0\d{8,10}$/.test(phone) ? phone : '';
}

export function normalizeWidgetVisitorInfo(value: unknown): NormalizedWidgetVisitorInfo {
    const input = record(value);
    return {
        name: text(input.name, 120),
        email: normalizeLeadEmail(input.email),
        phone: normalizeLeadPhone(input.phone),
        avatar: text(input.avatar, 2_000),
        // Consent is opt-in only. Truthy strings, a supplied email, or merely
        // opening the widget must never grant marketing permission.
        marketingConsent: input.marketingConsent === true,
        consentText: text(input.consentText, 500),
    };
}

export function extractContactFromMessage(messageContent: unknown): { email: string; phone: string } {
    const content = text(messageContent, 5_000);
    return {
        email: normalizeLeadEmail(content.match(EMAIL_IN_TEXT_RE)?.[0]),
        phone: normalizeLeadPhone(content.match(PHONE_IN_TEXT_RE)?.[1]),
    };
}

function meaningfulName(name: string): boolean {
    if (name.length < 2) return false;
    return !/^(kh[aá]ch|visitor|guest|anonymous|web user)(\s|$)/i.test(name);
}

function leadName(info: NormalizedWidgetVisitorInfo, email: string, phone: string): string {
    if (meaningfulName(info.name)) return info.name;
    if (email) return email.split('@')[0].slice(0, 80) || 'Khách website';
    return phone ? `Khách web ${phone.slice(-4)}` : 'Khách website';
}

function safeAcquisitionMetadata(value: unknown): JsonRecord {
    const input = record(value);
    const output: JsonRecord = {};
    const allowed = [
        ['pageUrl', 2_000], ['referrer', 2_000], ['domain', 253],
        ['utm_source', 200], ['utm_medium', 200], ['utm_campaign', 200],
        ['utm_term', 200], ['utm_content', 200], ['deviceType', 32],
        ['language', 32], ['timezone', 80],
    ] as const;
    for (const [key, limit] of allowed) {
        const cleaned = text(input[key], limit);
        if (cleaned) output[key] = cleaned;
    }
    return output;
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string').slice(0, 100)
        : [];
}

function isUniqueViolation(error: unknown): boolean {
    return record(error).code === 'P2002';
}

/**
 * Promote an identified widget visitor into the CRM pipeline.
 * Anonymous visitors intentionally remain Visitor records. Marketing consent
 * is stored separately from contact/support data and is always explicit.
 */
export async function captureLeadFromWidget(input: WidgetLeadCaptureInput) {
    const info = normalizeWidgetVisitorInfo(input.visitorInfo);
    const extracted = extractContactFromMessage(input.messageContent);
    const email = info.email || extracted.email;
    const phone = info.phone || extracted.phone;
    if (!email && !phone) return null;

    const now = new Date();
    const acquisition = safeAcquisitionMetadata(input.conversationMetadata);
    const existing = await prisma.lead.findFirst({
        where: {
            workspaceId: input.workspaceId,
            OR: [
                { widgetVisitorId: input.visitorId },
                ...(email ? [{ email }] : []),
                ...(phone ? [{ phone }] : []),
            ],
        },
    });
    const baseTags = ['auto-captured', 'source:widget'];
    if (typeof acquisition.utm_source === 'string') {
        baseTags.push(`utm:${acquisition.utm_source}`.slice(0, 100));
    }

    const buildUpdate = (lead: Lead): Prisma.LeadUpdateInput => {
        const currentMetadata = record(lead.metadata);
        const previousIds = stringArray(currentMetadata.conversationIds).filter(Boolean).slice(-49);
        const newConversation = !previousIds.includes(input.conversationId);
        const nextIds = newConversation
            ? [...previousIds, input.conversationId].slice(-50)
            : previousIds;
        const update: Record<string, unknown> = {
            lastContactedAt: now,
            tags: [...new Set([...stringArray(lead.tags), ...baseTags])],
            metadata: {
                ...currentMetadata,
                ...acquisition,
                widgetId: input.widgetId,
                widgetVisitorId: input.visitorId,
                latestConversationId: input.conversationId,
                conversationIds: nextIds,
                lastCapturedAt: now.toISOString(),
            },
        };
        if (!lead.widgetVisitorId) update.widgetVisitorId = input.visitorId;
        if (email && !lead.email) update.email = email;
        if (phone && !lead.phone) update.phone = phone;
        if (info.avatar && !lead.avatar) update.avatar = info.avatar;
        if (meaningfulName(info.name) && !meaningfulName(text(lead.name, 120))) update.name = info.name;
        if (newConversation) update.conversationCount = { increment: 1 };
        if (info.marketingConsent && !lead.marketingConsent) {
            update.marketingConsent = true;
            update.consentAt = now;
            update.consentSource = 'widget_prechat';
            update.metadata = { ...record(update.metadata), consentText: info.consentText };
        }
        return update as Prisma.LeadUpdateInput;
    };

    if (existing) {
        return prisma.lead.update({
            where: { id: existing.id },
            data: buildUpdate(existing),
        });
    }

    try {
        return await prisma.lead.create({
            data: {
                workspaceId: input.workspaceId,
                widgetVisitorId: input.visitorId,
                name: leadName(info, email, phone),
                phone,
                email,
                avatar: info.avatar,
                stage: 'mới',
                source: 'widget',
                tags: baseTags,
                marketingConsent: info.marketingConsent,
                consentAt: info.marketingConsent ? now : null,
                consentSource: info.marketingConsent ? 'widget_prechat' : null,
                lastContactedAt: now,
                conversationCount: 1,
                metadata: {
                    ...acquisition,
                    widgetId: input.widgetId,
                    widgetVisitorId: input.visitorId,
                    latestConversationId: input.conversationId,
                    conversationIds: [input.conversationId],
                    firstCapturedAt: now.toISOString(),
                    lastCapturedAt: now.toISOString(),
                    ...(info.marketingConsent ? { consentText: info.consentText } : {}),
                },
            } satisfies Prisma.LeadUncheckedCreateInput,
        });
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const winner = await prisma.lead.findFirst({
            where: { workspaceId: input.workspaceId, widgetVisitorId: input.visitorId },
        });
        if (!winner) throw error;
        return prisma.lead.update({
            where: { id: winner.id },
            data: buildUpdate(winner),
        });
    }
}
