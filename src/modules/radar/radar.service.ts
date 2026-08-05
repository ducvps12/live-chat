import crypto from 'crypto';
import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import net, { type LookupFunction } from 'net';
import prisma from '../../infra/prisma';
import { decryptSecret, encryptSecret } from '../../infra/secretVault';
import { AppError } from '../../middlewares/errorHandler';
import { subscriptionService } from '../subscription/subscription.service';
import { telegramNotifier } from '../notification/telegram-notifier.service';

const MAX_RESPONSE_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_INTERVAL_MINUTES = 43_200;
const MAX_CONCURRENT_CHECKS = 4;
const MAX_CONCURRENT_CHECKS_PER_WORKSPACE = 2;
const checking = new Set<string>();
const workspaceCheckCounts = new Map<string, number>();
let activeCheckCount = 0;

function inputRecord(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new AppError('Dữ liệu gửi lên không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    return input as Record<string, unknown>;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
        throw new AppError(`${field} phải là true hoặc false`, 400, 'VALIDATION_ERROR');
    }
    return value;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
        throw new AppError(`${field} phải là chuỗi`, 400, 'VALIDATION_ERROR');
    }
    const normalized = value.trim();
    if (normalized.length > maxLength) {
        throw new AppError(`${field} vượt quá ${maxLength} ký tự`, 400, 'VALIDATION_ERROR');
    }
    return normalized;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
    const normalized = optionalString(value, field, maxLength);
    if (!normalized) throw new AppError(`Vui lòng nhập ${field}`, 400, 'VALIDATION_ERROR');
    return normalized;
}

function intervalMinutes(value: unknown, minimum: number, fallback?: number): number {
    if (value === undefined || value === null || value === '') {
        if (fallback !== undefined) return fallback;
        throw new AppError('Vui lòng chọn tần suất kiểm tra', 400, 'VALIDATION_ERROR');
    }
    const parsed = typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value.trim())
            ? Number(value.trim())
            : Number.NaN;
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_INTERVAL_MINUTES) {
        throw new AppError(`Tần suất phải là số nguyên từ 1 đến ${MAX_INTERVAL_MINUTES} phút`, 400, 'VALIDATION_ERROR');
    }
    return Math.max(minimum, parsed);
}

function acquireCheckSlot(workspaceId: string, monitorId: string) {
    if (checking.has(monitorId)) {
        throw new AppError('Nguồn này đang được kiểm tra', 409, 'RADAR_CHECK_IN_PROGRESS');
    }
    if (activeCheckCount >= MAX_CONCURRENT_CHECKS) {
        throw new AppError('Radar đang bận, vui lòng thử lại sau', 429, 'RADAR_CHECK_THROTTLED');
    }
    const workspaceActive = workspaceCheckCounts.get(workspaceId) || 0;
    if (workspaceActive >= MAX_CONCURRENT_CHECKS_PER_WORKSPACE) {
        throw new AppError('Workspace đang có quá nhiều lượt kiểm tra', 429, 'RADAR_WORKSPACE_THROTTLED');
    }
    checking.add(monitorId);
    activeCheckCount += 1;
    workspaceCheckCounts.set(workspaceId, workspaceActive + 1);
}

function releaseCheckSlot(workspaceId: string, monitorId: string) {
    if (!checking.delete(monitorId)) return;
    activeCheckCount = Math.max(0, activeCheckCount - 1);
    const remaining = Math.max(0, (workspaceCheckCounts.get(workspaceId) || 1) - 1);
    if (remaining) workspaceCheckCounts.set(workspaceId, remaining);
    else workspaceCheckCounts.delete(workspaceId);
}

function privateAddress(address: string): boolean {
    if (net.isIPv4(address)) {
        const [a, b] = address.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || a >= 224
            || (a === 100 && b >= 64 && b <= 127)
            || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 0)
            || (a === 192 && b === 168)
            || (a === 198 && (b === 18 || b === 19));
    }
    if (net.isIPv6(address)) {
        const value = address.toLowerCase();
        if (value.startsWith('::ffff:')) {
            const mappedIpv4 = value.slice('::ffff:'.length);
            if (net.isIPv4(mappedIpv4)) return privateAddress(mappedIpv4);
        }
        return value === '::1' || value === '::' || value.startsWith('fc')
            || value.startsWith('fd') || value.startsWith('fe8')
            || value.startsWith('fe9') || value.startsWith('fea')
            || value.startsWith('feb');
    }
    return true;
}

type ResolvedPublicUrl = {
    url: URL;
    address: string;
    family: 4 | 6;
};

async function safeUrl(raw: string): Promise<ResolvedPublicUrl> {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new AppError('URL không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new AppError('Chỉ hỗ trợ URL HTTP/HTTPS công khai', 400, 'VALIDATION_ERROR');
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        throw new AppError('Không thể theo dõi địa chỉ nội bộ', 400, 'RADAR_UNSAFE_URL');
    }
    const addressFamily = net.isIP(hostname);
    const addresses = addressFamily
        ? [{ address: hostname, family: addressFamily as 4 | 6 }]
        : await dns.lookup(hostname, { all: true }).catch(() => [] as { address: string; family: 4 | 6 }[]);
    if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) {
        throw new AppError('Tên miền không phân giải tới địa chỉ công khai an toàn', 400, 'RADAR_UNSAFE_URL');
    }
    return { url, address: addresses[0].address, family: addresses[0].family as 4 | 6 };
}

type PinnedResponse = {
    status: number;
    location: string;
    body: string;
};

async function requestPinned(target: ResolvedPublicUrl): Promise<PinnedResponse> {
    const lookup: LookupFunction = (_hostname, options, callback) => {
        if (options.all) {
            callback(null, [{ address: target.address, family: target.family }]);
            return;
        }
        callback(null, target.address, target.family);
    };
    return new Promise((resolve, reject) => {
        let settled = false;
        let deadline: NodeJS.Timeout | null = null;
        const clearDeadline = () => {
            if (!deadline) return;
            clearTimeout(deadline);
            deadline = null;
        };
        const resolveOnce = (value: PinnedResponse) => {
            if (settled) return;
            settled = true;
            clearDeadline();
            resolve(value);
        };
        const rejectOnce = (error: Error) => {
            if (settled) return;
            settled = true;
            clearDeadline();
            reject(error);
        };
        const handleResponse = (response: http.IncomingMessage) => {
            const status = response.statusCode || 0;
            const location = String(response.headers.location || '');
            const contentType = String(response.headers['content-type'] || '');
            if ([301, 302, 303, 307, 308].includes(status)) {
                resolveOnce({ status, location, body: '' });
                response.destroy();
                return;
            }
            if (status === 401 || status === 403) {
                rejectOnce(new AppError(
                    `Website chặn máy chủ giám sát (HTTP ${status}). Hãy dùng URL công khai, RSS hoặc API chính thức của website.`,
                    422,
                    'RADAR_SOURCE_BLOCKED',
                ));
                response.destroy();
                return;
            }
            if (status === 429) {
                rejectOnce(new AppError('Website đang giới hạn lượt kiểm tra (HTTP 429). Radar sẽ thử lại theo lịch.', 429, 'RADAR_SOURCE_RATE_LIMITED'));
                response.destroy();
                return;
            }
            if (status < 200 || status >= 300) {
                rejectOnce(new AppError(`Website phản hồi HTTP ${status}`, 422, 'RADAR_FETCH_ERROR'));
                response.destroy();
                return;
            }
            if (!/(text|html|json|xml)/i.test(contentType)) {
                rejectOnce(new AppError('Loại nội dung này chưa được hỗ trợ', 400, 'RADAR_UNSUPPORTED_CONTENT'));
                response.destroy();
                return;
            }
            const declared = Number(response.headers['content-length'] || 0);
            if (declared > MAX_RESPONSE_BYTES) {
                rejectOnce(new AppError('Trang vượt quá giới hạn 1 MB', 400, 'RADAR_RESPONSE_TOO_LARGE'));
                response.destroy();
                return;
            }
            const chunks: Buffer[] = [];
            let total = 0;
            response.on('data', (chunk: Buffer | string) => {
                if (settled) return;
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                total += buffer.length;
                if (total > MAX_RESPONSE_BYTES) {
                    rejectOnce(new AppError('Trang vượt quá giới hạn 1 MB', 400, 'RADAR_RESPONSE_TOO_LARGE'));
                    response.destroy();
                    return;
                }
                chunks.push(buffer);
            });
            response.on('end', () => {
                resolveOnce({ status, location, body: Buffer.concat(chunks).toString('utf8') });
            });
            response.on('aborted', () => rejectOnce(new AppError('Website đã ngắt kết nối', 400, 'RADAR_FETCH_ERROR')));
            response.on('error', rejectOnce);
        };
        const options: http.RequestOptions = {
            method: 'GET',
            lookup,
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NemarkChat-SignalRadar/1.0',
            },
        };
        const request = target.url.protocol === 'https:'
            ? https.request(target.url, { ...options, servername: net.isIP(target.url.hostname) ? undefined : target.url.hostname }, handleResponse)
            : http.request(target.url, options, handleResponse);
        deadline = setTimeout(() => {
            request.destroy(new AppError('Website phản hồi quá chậm', 400, 'RADAR_FETCH_TIMEOUT'));
        }, FETCH_TIMEOUT_MS);
        deadline.unref();
        request.setTimeout(FETCH_TIMEOUT_MS, () => {
            request.destroy(new AppError('Website phản hồi quá chậm', 400, 'RADAR_FETCH_TIMEOUT'));
        });
        request.on('error', rejectOnce);
        request.end();
    });
}

function normalizedContent(raw: string): { title: string; text: string } {
    const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const text = raw
        .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 250_000);
    return { title, text };
}

export async function fetchPublicPage(rawUrl: string) {
    let target = await safeUrl(rawUrl);
    for (let redirect = 0; redirect <= 3; redirect += 1) {
        const response = await requestPinned(target);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            if (!response.location || redirect === 3) throw new AppError('Trang chuyển hướng quá nhiều lần', 400, 'RADAR_REDIRECT_ERROR');
            target = await safeUrl(new URL(response.location, target.url).toString());
            continue;
        }
        const normalized = normalizedContent(response.body);
        return {
            ...normalized,
            finalUrl: target.url.toString(),
            httpStatus: response.status,
            hash: crypto.createHash('sha256').update(normalized.text).digest('hex'),
        };
    }
    throw new AppError('Không thể tải website', 400, 'RADAR_FETCH_ERROR');
}

function cleanName(value: unknown): string {
    return requiredString(value, 'tên theo dõi', 100);
}

async function telegramConfig(workspaceId: string) {
    const setting = await prisma.signalAlertSetting.findUnique({ where: { workspaceId } });
    if (!setting?.telegramEnabled || !setting.telegramBotTokenEncrypted || !setting.telegramChatId) return null;
    return {
        config: {
            enabled: true,
            botToken: decryptSecret(setting.telegramBotTokenEncrypted),
            chatId: setting.telegramChatId,
        },
        notifyOnChange: setting.notifyOnChange,
        notifyOnError: setting.notifyOnError,
    };
}

async function alertChange(workspaceId: string, name: string, url: string, summary: string) {
    const config = await telegramConfig(workspaceId);
    if (!config?.notifyOnChange) return;
    await telegramNotifier.notify(`🔔 NemarkChat Radar phát hiện thay đổi\n\n${name}\n${summary}\n${url}`, { config: config.config }).catch(() => undefined);
}

async function alertError(workspaceId: string, name: string, url: string, message: string) {
    const config = await telegramConfig(workspaceId);
    if (!config?.notifyOnError) return;
    await telegramNotifier.notify(`⚠️ NemarkChat Radar không thể kiểm tra nguồn\n\n${name}\n${message}\n${url}`, { config: config.config }).catch(() => undefined);
}

export const signalRadarService = {
    async entitlements(workspaceId: string) {
        return subscriptionService.getSignalRadarEntitlements(workspaceId);
    },

    async list(workspaceId: string) {
        return prisma.signalMonitor.findMany({
            where: { workspaceId },
            include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 8 } },
            orderBy: { createdAt: 'desc' },
        });
    },

    async create(workspaceId: string, userId: string, input: unknown) {
        const values = inputRecord(input);
        const entitlements = await this.entitlements(workspaceId);
        if (!entitlements.active) throw new AppError('Gói hiện tại không hỗ trợ Radar tín hiệu', 403, 'RADAR_PLAN_REQUIRED');
        const count = await prisma.signalMonitor.count({ where: { workspaceId } });
        if (count >= entitlements.maxMonitors) throw new AppError(`Gói hiện tại chỉ cho phép ${entitlements.maxMonitors} nguồn theo dõi`, 403, 'RADAR_QUOTA_EXCEEDED');
        const url = (await safeUrl(requiredString(values.url, 'URL', 2048))).url.toString();
        const parsedInterval = intervalMinutes(values.intervalMinutes, entitlements.minIntervalMinutes, entitlements.minIntervalMinutes);
        return prisma.signalMonitor.create({
            data: { workspaceId, createdById: userId, name: cleanName(values.name), url, intervalMinutes: parsedInterval, nextCheckAt: new Date() },
        });
    },

    async update(workspaceId: string, monitorId: string, input: unknown) {
        const values = inputRecord(input);
        const current = await prisma.signalMonitor.findFirst({ where: { id: monitorId, workspaceId } });
        if (!current) throw new AppError('Nguồn theo dõi không tồn tại', 404, 'NOT_FOUND');
        const entitlements = await this.entitlements(workspaceId);
        const data: Record<string, unknown> = {};
        if (values.name !== undefined) data.name = cleanName(values.name);
        if (values.url !== undefined) {
            const nextUrl = (await safeUrl(requiredString(values.url, 'URL', 2048))).url.toString();
            data.url = nextUrl;
            if (nextUrl !== current.url) {
                data.lastContentHash = '';
                data.lastHttpStatus = null;
                data.lastCheckedAt = null;
                data.lastChangedAt = null;
                data.lastError = null;
                data.consecutiveErrors = 0;
                data.status = current.isActive ? 'pending' : 'paused';
                data.nextCheckAt = current.isActive ? new Date() : null;
            }
        }
        if (values.intervalMinutes !== undefined) {
            data.intervalMinutes = intervalMinutes(values.intervalMinutes, entitlements.minIntervalMinutes);
        }
        const isActive = optionalBoolean(values.isActive, 'isActive');
        if (isActive !== undefined) {
            data.isActive = isActive;
            data.status = isActive ? 'pending' : 'paused';
            data.nextCheckAt = isActive ? new Date() : null;
        }
        const notifyTelegram = optionalBoolean(values.notifyTelegram, 'notifyTelegram');
        if (notifyTelegram !== undefined) data.notifyTelegram = notifyTelegram;
        return prisma.signalMonitor.update({ where: { id: current.id }, data });
    },

    async remove(workspaceId: string, monitorId: string) {
        const current = await prisma.signalMonitor.findFirst({ where: { id: monitorId, workspaceId } });
        if (!current) throw new AppError('Nguồn theo dõi không tồn tại', 404, 'NOT_FOUND');
        await prisma.signalMonitor.delete({ where: { id: current.id } });
    },

    async check(workspaceId: string, monitorId: string) {
        const monitor = await prisma.signalMonitor.findFirst({ where: { id: monitorId, workspaceId } });
        if (!monitor) throw new AppError('Nguồn theo dõi không tồn tại', 404, 'NOT_FOUND');
        const entitlements = await this.entitlements(workspaceId);
        if (!entitlements.active) {
            await prisma.signalMonitor.update({
                where: { id: monitor.id },
                data: { isActive: false, status: 'paused', nextCheckAt: null },
            });
            throw new AppError('Gói hiện tại không còn hỗ trợ Radar tín hiệu', 403, 'RADAR_PLAN_REQUIRED');
        }
        acquireCheckSlot(workspaceId, monitorId);
        const now = new Date();
        try {
            const page = await fetchPublicPage(monitor.url);
            const changed = Boolean(monitor.lastContentHash && monitor.lastContentHash !== page.hash);
            const summary = changed ? 'Nội dung công khai của trang đã khác lần kiểm tra trước.' : 'Đã tạo mốc nội dung ban đầu.';
            await prisma.$transaction(async (tx) => {
                if (!monitor.lastContentHash || changed) {
                    await tx.signalSnapshot.create({
                        data: {
                            monitorId: monitor.id,
                            workspaceId,
                            contentHash: page.hash,
                            title: page.title,
                            excerpt: page.text.slice(0, 1500),
                            diffSummary: summary,
                            changed,
                            httpStatus: page.httpStatus,
                        },
                    });
                }
                await tx.signalMonitor.update({
                    where: { id: monitor.id },
                    data: {
                        url: page.finalUrl,
                        status: changed ? 'changed' : 'healthy',
                        lastCheckedAt: now,
                        nextCheckAt: new Date(now.getTime() + monitor.intervalMinutes * 60_000),
                        lastChangedAt: changed ? now : monitor.lastChangedAt,
                        lastContentHash: page.hash,
                        lastHttpStatus: page.httpStatus,
                        lastError: null,
                        consecutiveErrors: 0,
                    },
                });
                const old = await tx.signalSnapshot.findMany({
                    where: { monitorId },
                    orderBy: { createdAt: 'desc' },
                    skip: entitlements.snapshotRetention,
                    select: { id: true },
                });
                if (old.length) {
                    await tx.signalSnapshot.deleteMany({ where: { id: { in: old.map((item) => item.id) } } });
                }
            });
            if (changed && monitor.notifyTelegram) await alertChange(workspaceId, monitor.name, page.finalUrl, summary);
            return { changed, summary, checkedAt: now };
        } catch (error) {
            const message = error instanceof Error ? error.message.slice(0, 500) : 'Không thể kiểm tra website';
            const nextErrorCount = monitor.consecutiveErrors + 1;
            await prisma.signalMonitor.update({
                where: { id: monitor.id },
                data: { status: 'error', lastCheckedAt: now, nextCheckAt: new Date(now.getTime() + monitor.intervalMinutes * 60_000), lastError: message, consecutiveErrors: { increment: 1 } },
            });
            if (monitor.notifyTelegram && nextErrorCount === 3) {
                await alertError(workspaceId, monitor.name, monitor.url, message);
            }
            return { changed: false, summary: message, checkedAt: now, status: 'error', error: message };
        } finally {
            releaseCheckSlot(workspaceId, monitorId);
        }
    },

    async getAlertSetting(workspaceId: string) {
        const setting = await prisma.signalAlertSetting.findUnique({ where: { workspaceId } });
        return {
            telegramEnabled: setting?.telegramEnabled || false,
            telegramChatId: setting?.telegramChatId || '',
            hasTelegramBotToken: Boolean(setting?.telegramBotTokenEncrypted),
            notifyOnChange: setting?.notifyOnChange ?? true,
            notifyOnError: setting?.notifyOnError ?? true,
        };
    },

    async saveAlertSetting(workspaceId: string, input: unknown) {
        const values = inputRecord(input);
        const current = await prisma.signalAlertSetting.findUnique({ where: { workspaceId } });
        const token = optionalString(values.telegramBotToken, 'telegramBotToken', 512) || '';
        const chatId = optionalString(values.telegramChatId, 'telegramChatId', 100) || '';
        const clearToken = optionalBoolean(values.clearTelegramBotToken, 'clearTelegramBotToken') || false;
        const telegramEnabled = optionalBoolean(values.telegramEnabled, 'telegramEnabled') || false;
        const notifyOnChange = optionalBoolean(values.notifyOnChange, 'notifyOnChange') ?? true;
        const notifyOnError = optionalBoolean(values.notifyOnError, 'notifyOnError') ?? true;
        if (clearToken && token) {
            throw new AppError('Không thể vừa xóa vừa thay Bot Token', 400, 'VALIDATION_ERROR');
        }
        const hasToken = Boolean(token || (!clearToken && current?.telegramBotTokenEncrypted));
        if (telegramEnabled && (!hasToken || !chatId)) {
            throw new AppError('Vui lòng nhập Bot Token và Chat ID trước khi bật Telegram', 400, 'TELEGRAM_INVALID_CONFIG');
        }
        await prisma.signalAlertSetting.upsert({
            where: { workspaceId },
            create: {
                workspaceId,
                telegramEnabled,
                telegramChatId: chatId,
                telegramBotTokenEncrypted: token ? encryptSecret(token) : null,
                notifyOnChange,
                notifyOnError,
            },
            update: {
                telegramEnabled,
                telegramChatId: chatId,
                telegramBotTokenEncrypted: clearToken ? null : token ? encryptSecret(token) : current?.telegramBotTokenEncrypted,
                notifyOnChange,
                notifyOnError,
            },
        });
        return this.getAlertSetting(workspaceId);
    },

    async testAlert(workspaceId: string, input: unknown) {
        const values = inputRecord(input);
        const current = await prisma.signalAlertSetting.findUnique({ where: { workspaceId } });
        const token = (optionalString(values.telegramBotToken, 'telegramBotToken', 512) || '')
            || (current?.telegramBotTokenEncrypted ? decryptSecret(current.telegramBotTokenEncrypted) : '');
        const chatId = (optionalString(values.telegramChatId, 'telegramChatId', 100) || '')
            || current?.telegramChatId || '';
        if (!token || !chatId) throw new AppError('Vui lòng nhập Bot Token và Chat ID', 400, 'TELEGRAM_INVALID_CONFIG');
        return telegramNotifier.sendTestMessage({ config: { enabled: true, botToken: token, chatId }, message: '✅ NemarkChat Signal Radar đã kết nối Telegram thành công.' });
    },
};

let schedulerTimer: NodeJS.Timeout | null = null;
let schedulerRunning = false;

async function runDueChecks() {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
        const availableSlots = Math.max(0, MAX_CONCURRENT_CHECKS - activeCheckCount);
        if (!availableSlots) return;
        const due = await prisma.signalMonitor.findMany({
            where: { isActive: true, OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: new Date() } }] },
            orderBy: { nextCheckAt: 'asc' },
            take: MAX_CONCURRENT_CHECKS * 10,
        });
        const selectedWorkspaceCounts = new Map<string, number>();
        const selected: typeof due = [];
        for (const monitor of due) {
            if (selected.length >= availableSlots) break;
            const alreadyActive = workspaceCheckCounts.get(monitor.workspaceId) || 0;
            const alreadySelected = selectedWorkspaceCounts.get(monitor.workspaceId) || 0;
            if (alreadyActive + alreadySelected >= MAX_CONCURRENT_CHECKS_PER_WORKSPACE) continue;
            selectedWorkspaceCounts.set(monitor.workspaceId, alreadySelected + 1);
            selected.push(monitor);
        }
        const results = await Promise.allSettled(selected.map((monitor) => signalRadarService.check(monitor.workspaceId, monitor.id)));
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const monitor = selected[index];
                const error = result.reason;
                console.warn(`[SignalRadar] ${monitor.id} failed: ${error instanceof Error ? error.message : 'unknown'}`);
            }
        });
    } finally {
        schedulerRunning = false;
    }
}

function invokeSchedulerSafely() {
    void runDueChecks().catch((error) => {
        console.error(`[SignalRadar] scheduler failed: ${error instanceof Error ? error.message : 'unknown'}`);
    });
}

export function startSignalRadarScheduler() {
    if (schedulerTimer) return () => undefined;
    const initial = setTimeout(invokeSchedulerSafely, 10_000);
    schedulerTimer = setInterval(invokeSchedulerSafely, 60_000);
    initial.unref();
    schedulerTimer.unref();
    return () => {
        clearTimeout(initial);
        if (schedulerTimer) clearInterval(schedulerTimer);
        schedulerTimer = null;
    };
}
