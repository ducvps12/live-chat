import crypto from 'node:crypto';
import net from 'node:net';
import os from 'node:os';
import tls from 'node:tls';
import { SETTINGS_KEYS, settingsService } from '../admin/settings.service';
import { systemNotificationService } from '../notification/system-notification.service';

export interface SmtpConfigInput {
    enabled?: boolean | string;
    host?: string;
    port?: number | string;
    secure?: boolean | string;
    requireTls?: boolean | string;
    user?: string;
    /** Alias used by the admin UI. */
    username?: string;
    password?: string;
    fromEmail?: string;
    fromName?: string;
    connectionTimeoutMs?: number | string;
    commandTimeoutMs?: number | string;
    tlsRejectUnauthorized?: boolean | string;
}

export interface SmtpConfig {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    requireTls: boolean;
    user: string;
    password: string;
    fromEmail: string;
    fromName: string;
    connectionTimeoutMs: number;
    commandTimeoutMs: number;
    tlsRejectUnauthorized: boolean;
}

export interface SmtpMailMessage {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    fromEmail?: string;
    fromName?: string;
}

export type SmtpErrorCode =
    | 'SMTP_NOT_CONFIGURED'
    | 'SMTP_INVALID_CONFIG'
    | 'SMTP_INVALID_ADDRESS'
    | 'SMTP_CONNECT_FAILED'
    | 'SMTP_TIMEOUT'
    | 'SMTP_TLS_REQUIRED'
    | 'SMTP_TLS_FAILED'
    | 'SMTP_AUTH_FAILED'
    | 'SMTP_RECIPIENT_REJECTED'
    | 'SMTP_MESSAGE_REJECTED'
    | 'SMTP_PROTOCOL_ERROR'
    | 'SMTP_UNAVAILABLE';

export interface SafeSmtpError {
    code: SmtpErrorCode;
    message: string;
    phase: string;
    retryable: boolean;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MASKED_SECRET_RE = /(?:[•*]{4,}|^\*+$)/;
const MAX_MESSAGE_BYTES = 1_000_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 8_000;
const DEFAULT_COMMAND_TIMEOUT_MS = 12_000;

const SAFE_MESSAGES: Record<SmtpErrorCode, string> = {
    SMTP_NOT_CONFIGURED: 'SMTP chưa được cấu hình đầy đủ.',
    SMTP_INVALID_CONFIG: 'Cấu hình SMTP không hợp lệ.',
    SMTP_INVALID_ADDRESS: 'Địa chỉ email không hợp lệ.',
    SMTP_CONNECT_FAILED: 'Không thể kết nối tới máy chủ SMTP.',
    SMTP_TIMEOUT: 'Máy chủ SMTP phản hồi quá thời gian cho phép.',
    SMTP_TLS_REQUIRED: 'Máy chủ SMTP không hỗ trợ kết nối TLS bắt buộc.',
    SMTP_TLS_FAILED: 'Không thể thiết lập kết nối TLS an toàn.',
    SMTP_AUTH_FAILED: 'Máy chủ SMTP từ chối thông tin đăng nhập.',
    SMTP_RECIPIENT_REJECTED: 'Máy chủ SMTP từ chối địa chỉ nhận.',
    SMTP_MESSAGE_REJECTED: 'Máy chủ SMTP từ chối nội dung email.',
    SMTP_PROTOCOL_ERROR: 'Máy chủ SMTP trả về phản hồi không hợp lệ.',
    SMTP_UNAVAILABLE: 'Dịch vụ SMTP tạm thời không khả dụng.',
};

export class SmtpServiceError extends Error {
    readonly code: SmtpErrorCode;
    readonly phase: string;
    readonly retryable: boolean;

    constructor(
        code: SmtpErrorCode,
        phase: string,
        retryable = false,
        cause?: unknown,
    ) {
        super(SAFE_MESSAGES[code], cause === undefined ? undefined : { cause });
        this.name = 'SmtpServiceError';
        this.code = code;
        this.phase = phase;
        this.retryable = retryable;
    }
}

export function toSafeSmtpError(error: unknown): SafeSmtpError {
    const safe = error instanceof SmtpServiceError
        ? error
        : mapTransportError(error, 'unknown');
    return {
        code: safe.code,
        message: SAFE_MESSAGES[safe.code],
        phase: safe.phase,
        retryable: safe.retryable,
    };
}

function cleanInline(value: unknown, maxLength: number): string {
    return typeof value === 'string'
        ? value
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLength)
        : '';
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeEmail(value: unknown, phase = 'config'): string {
    const email = cleanInline(value, 320).toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
        throw new SmtpServiceError('SMTP_INVALID_ADDRESS', phase);
    }
    return email;
}

function optionalSecret(value: unknown): string {
    const secret = typeof value === 'string' ? value.trim() : '';
    return secret && !MASKED_SECRET_RE.test(secret) ? secret.slice(0, 4096) : '';
}

export function normalizeSmtpConfig(input: SmtpConfigInput): SmtpConfig {
    const secure = parseBoolean(input.secure, Number(input.port) === 465);
    const port = boundedInteger(input.port, secure ? 465 : 587, 1, 65_535);
    const host = cleanInline(input.host, 253);
    const user = cleanInline(input.user ?? input.username, 320);
    const password = optionalSecret(input.password);
    const fromCandidate = cleanInline(input.fromEmail, 320) || (EMAIL_RE.test(user) ? user : '');
    const fromEmail = fromCandidate ? normalizeEmail(fromCandidate, 'config') : '';

    if (!host) throw new SmtpServiceError('SMTP_NOT_CONFIGURED', 'config');
    if ((user && !password) || (!user && password)) {
        throw new SmtpServiceError('SMTP_INVALID_CONFIG', 'config');
    }
    if (!fromEmail) throw new SmtpServiceError('SMTP_NOT_CONFIGURED', 'config');

    return {
        enabled: parseBoolean(input.enabled, true),
        host,
        port,
        secure,
        requireTls: secure || parseBoolean(input.requireTls, true),
        user,
        password,
        fromEmail,
        fromName: cleanInline(input.fromName, 120),
        connectionTimeoutMs: boundedInteger(
            input.connectionTimeoutMs,
            DEFAULT_CONNECTION_TIMEOUT_MS,
            1_000,
            30_000,
        ),
        commandTimeoutMs: boundedInteger(
            input.commandTimeoutMs,
            DEFAULT_COMMAND_TIMEOUT_MS,
            1_000,
            30_000,
        ),
        // Production never permits an administrator setting to disable
        // certificate verification. Local test servers may opt out explicitly.
        tlsRejectUnauthorized: process.env.NODE_ENV === 'production'
            ? true
            : parseBoolean(input.tlsRejectUnauthorized, true),
    };
}

function settingOrOverride<T extends string | number | boolean>(
    envKey: string,
    override: T | undefined,
    setting: string | undefined,
): T | string | undefined {
    if (override !== undefined && override !== '') return override;
    if (setting !== undefined && setting !== '') return setting;
    return process.env[envKey];
}

export async function resolveSmtpConfig(overrides: SmtpConfigInput = {}): Promise<SmtpConfig> {
    const [settings, storedPassword] = await Promise.all([
        settingsService.getAll(),
        settingsService.getSecret(SETTINGS_KEYS.SMTP_PASSWORD, ''),
    ]);
    return normalizeSmtpConfig({
        enabled: settingOrOverride(
            'SMTP_ENABLED',
            overrides.enabled,
            settings[SETTINGS_KEYS.SMTP_ENABLED],
        ),
        host: settingOrOverride('SMTP_HOST', overrides.host, settings[SETTINGS_KEYS.SMTP_HOST]) as string,
        port: settingOrOverride('SMTP_PORT', overrides.port, settings[SETTINGS_KEYS.SMTP_PORT]),
        secure: settingOrOverride('SMTP_SECURE', overrides.secure, settings[SETTINGS_KEYS.SMTP_SECURE]),
        requireTls: settingOrOverride(
            'SMTP_REQUIRE_TLS',
            overrides.requireTls,
            settings[SETTINGS_KEYS.SMTP_REQUIRE_TLS],
        ),
        user: settingOrOverride(
            'SMTP_USER',
            overrides.user ?? overrides.username,
            settings[SETTINGS_KEYS.SMTP_USERNAME] || settings[SETTINGS_KEYS.SMTP_USER],
        ) as string,
        password: settingOrOverride(
            'SMTP_PASSWORD',
            optionalSecret(overrides.password),
            storedPassword,
        ) as string,
        fromEmail: settingOrOverride(
            'SMTP_FROM_EMAIL',
            overrides.fromEmail,
            settings[SETTINGS_KEYS.SMTP_FROM_EMAIL],
        ) as string,
        fromName: settingOrOverride(
            'SMTP_FROM_NAME',
            overrides.fromName,
            settings[SETTINGS_KEYS.SMTP_FROM_NAME],
        ) as string,
        connectionTimeoutMs: settingOrOverride(
            'SMTP_CONNECTION_TIMEOUT_MS',
            overrides.connectionTimeoutMs,
            settings[SETTINGS_KEYS.SMTP_CONNECTION_TIMEOUT_MS],
        ),
        commandTimeoutMs: settingOrOverride(
            'SMTP_COMMAND_TIMEOUT_MS',
            overrides.commandTimeoutMs,
            settings[SETTINGS_KEYS.SMTP_COMMAND_TIMEOUT_MS],
        ),
        tlsRejectUnauthorized: settingOrOverride(
            'SMTP_TLS_REJECT_UNAUTHORIZED',
            overrides.tlsRejectUnauthorized,
            settings[SETTINGS_KEYS.SMTP_TLS_REJECT_UNAUTHORIZED],
        ),
    });
}

interface SmtpReply {
    code: number;
    lines: string[];
}

type SmtpSocket = net.Socket | tls.TLSSocket;

class SmtpReplyReader {
    private buffer = '';
    private currentCode = 0;
    private currentLines: string[] = [];
    private queue: SmtpReply[] = [];
    private waiter: {
        resolve: (reply: SmtpReply) => void;
        reject: (error: unknown) => void;
    } | null = null;
    private terminalError: unknown = null;

    constructor(private readonly socket: SmtpSocket) {
        socket.on('data', this.onData);
        socket.on('error', this.onError);
        socket.on('close', this.onClose);
    }

    private readonly onData = (chunk: Buffer) => {
        this.buffer += chunk.toString('utf8');
        let boundary = this.buffer.indexOf('\n');
        while (boundary >= 0) {
            const line = this.buffer.slice(0, boundary).replace(/\r$/, '');
            this.buffer = this.buffer.slice(boundary + 1);
            this.consumeLine(line);
            boundary = this.buffer.indexOf('\n');
        }
    };

    private readonly onError = (error: unknown) => {
        this.fail(error);
    };

    private readonly onClose = () => {
        if (!this.terminalError) {
            this.fail(new SmtpServiceError('SMTP_UNAVAILABLE', 'connection', true));
        }
    };

    private consumeLine(line: string): void {
        const match = /^(\d{3})([ -])(.*)$/.exec(line);
        if (!match) {
            this.fail(new SmtpServiceError('SMTP_PROTOCOL_ERROR', 'response'));
            return;
        }

        const code = Number(match[1]);
        if (this.currentCode && code !== this.currentCode) {
            this.fail(new SmtpServiceError('SMTP_PROTOCOL_ERROR', 'response'));
            return;
        }
        this.currentCode = code;
        this.currentLines.push(match[3]);

        if (match[2] === ' ') {
            const reply = { code, lines: this.currentLines };
            this.currentCode = 0;
            this.currentLines = [];
            this.deliver(reply);
        }
    }

    private deliver(reply: SmtpReply): void {
        if (this.waiter) {
            const waiter = this.waiter;
            this.waiter = null;
            waiter.resolve(reply);
            return;
        }
        this.queue.push(reply);
    }

    private fail(error: unknown): void {
        if (this.terminalError) return;
        this.terminalError = error;
        if (this.waiter) {
            const waiter = this.waiter;
            this.waiter = null;
            waiter.reject(error);
        }
    }

    next(): Promise<SmtpReply> {
        const queued = this.queue.shift();
        if (queued) return Promise.resolve(queued);
        if (this.terminalError) return Promise.reject(this.terminalError);
        if (this.waiter) {
            return Promise.reject(new SmtpServiceError('SMTP_PROTOCOL_ERROR', 'response'));
        }
        return new Promise((resolve, reject) => {
            this.waiter = { resolve, reject };
        });
    }

    dispose(): void {
        this.socket.off('data', this.onData);
        this.socket.off('error', this.onError);
        this.socket.off('close', this.onClose);
    }
}

function socketServerName(host: string): string | undefined {
    return net.isIP(host) ? undefined : host;
}

function connectPlain(config: SmtpConfig): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        const socket = net.connect({ host: config.host, port: config.port });
        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new SmtpServiceError('SMTP_TIMEOUT', 'connect', true));
        }, config.connectionTimeoutMs);

        const finish = (error?: unknown) => {
            clearTimeout(timeout);
            socket.off('connect', onConnect);
            socket.off('error', onError);
            if (error) reject(error);
            else resolve(socket);
        };
        const onConnect = () => finish();
        const onError = (error: unknown) => finish(error);
        socket.once('connect', onConnect);
        socket.once('error', onError);
    });
}

function connectSecure(config: SmtpConfig, socket?: net.Socket): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
        const secureSocket = tls.connect({
            ...(socket ? { socket } : { host: config.host, port: config.port }),
            servername: socketServerName(config.host),
            rejectUnauthorized: config.tlsRejectUnauthorized,
            minVersion: 'TLSv1.2',
        });
        const timeout = setTimeout(() => {
            secureSocket.destroy();
            reject(new SmtpServiceError('SMTP_TIMEOUT', 'tls', true));
        }, config.connectionTimeoutMs);

        const finish = (error?: unknown) => {
            clearTimeout(timeout);
            secureSocket.off('secureConnect', onSecure);
            secureSocket.off('error', onError);
            if (error) reject(error);
            else resolve(secureSocket);
        };
        const onSecure = () => finish();
        const onError = (error: unknown) => finish(error);
        secureSocket.once('secureConnect', onSecure);
        secureSocket.once('error', onError);
    });
}

function mapTransportError(error: unknown, phase: string): SmtpServiceError {
    if (error instanceof SmtpServiceError) return error;
    const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
    if (['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code)) {
        return new SmtpServiceError('SMTP_TIMEOUT', phase, true, error);
    }
    if (
        code.startsWith('ERR_TLS')
        || code.includes('CERT')
        || code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
    ) {
        return new SmtpServiceError('SMTP_TLS_FAILED', phase, false, error);
    }
    if (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
        return new SmtpServiceError('SMTP_CONNECT_FAILED', phase, true, error);
    }
    return new SmtpServiceError('SMTP_UNAVAILABLE', phase, true, error);
}

function expectReply(
    reply: SmtpReply,
    allowedCodes: number[],
    phase: string,
): SmtpReply {
    if (allowedCodes.includes(reply.code)) return reply;
    if (phase === 'auth' || reply.code === 535) {
        throw new SmtpServiceError('SMTP_AUTH_FAILED', phase);
    }
    if (phase === 'recipient') {
        throw new SmtpServiceError('SMTP_RECIPIENT_REJECTED', phase, reply.code >= 400 && reply.code < 500);
    }
    if (phase === 'message') {
        throw new SmtpServiceError('SMTP_MESSAGE_REJECTED', phase, reply.code >= 400 && reply.code < 500);
    }
    throw new SmtpServiceError('SMTP_PROTOCOL_ERROR', phase, reply.code >= 400 && reply.code < 500);
}

function writeSocket(socket: SmtpSocket, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
        socket.write(payload, 'utf8', error => {
            if (error) reject(error);
            else resolve();
        });
    });
}

function safeCommandArgument(value: string, phase: string): string {
    if (/[\r\n]/.test(value)) {
        throw new SmtpServiceError('SMTP_INVALID_CONFIG', phase);
    }
    return value;
}

function helloName(): string {
    return cleanInline(os.hostname(), 120).replace(/[^a-zA-Z0-9.-]/g, '-') || 'localhost';
}

class SmtpSession {
    private socket: SmtpSocket | null = null;
    private reader: SmtpReplyReader | null = null;
    private encrypted = false;
    private capabilities: string[] = [];

    constructor(private readonly config: SmtpConfig) {}

    private setSocket(socket: SmtpSocket, encrypted: boolean): void {
        this.socket = socket;
        this.encrypted = encrypted;
        socket.setTimeout(this.config.commandTimeoutMs, () => {
            socket.destroy(new SmtpServiceError('SMTP_TIMEOUT', 'command', true));
        });
        this.reader = new SmtpReplyReader(socket);
    }

    private async command(
        command: string,
        allowedCodes: number[],
        phase: string,
    ): Promise<SmtpReply> {
        if (!this.socket || !this.reader) {
            throw new SmtpServiceError('SMTP_PROTOCOL_ERROR', phase);
        }
        await writeSocket(this.socket, `${safeCommandArgument(command, phase)}\r\n`);
        return expectReply(await this.reader.next(), allowedCodes, phase);
    }

    private async ehlo(): Promise<string[]> {
        const reply = await this.command(`EHLO ${helloName()}`, [250], 'hello');
        return reply.lines.map(line => cleanInline(line, 500).toUpperCase());
    }

    private async authenticate(): Promise<void> {
        const { user, password } = this.config;
        if (!user && !password) return;
        if (!this.encrypted) {
            throw new SmtpServiceError('SMTP_TLS_REQUIRED', 'auth');
        }

        const authCapability = this.capabilities.find(line => line.startsWith('AUTH'));
        const methods = authCapability ? authCapability.split(/\s+/).slice(1) : [];
        if (methods.includes('PLAIN') || methods.length === 0) {
            const token = Buffer.from(`\u0000${user}\u0000${password}`, 'utf8').toString('base64');
            const reply = await this.command(`AUTH PLAIN ${token}`, [235, 334, 503], 'auth');
            if (reply.code === 334) {
                await this.command(token, [235], 'auth');
            }
            return;
        }
        if (methods.includes('LOGIN')) {
            await this.command('AUTH LOGIN', [334], 'auth');
            await this.command(Buffer.from(user, 'utf8').toString('base64'), [334], 'auth');
            await this.command(Buffer.from(password, 'utf8').toString('base64'), [235], 'auth');
            return;
        }
        throw new SmtpServiceError('SMTP_AUTH_FAILED', 'auth');
    }

    async connect(): Promise<void> {
        try {
            if (this.config.secure) {
                this.setSocket(await connectSecure(this.config), true);
            } else {
                this.setSocket(await connectPlain(this.config), false);
            }
            if (!this.reader) throw new SmtpServiceError('SMTP_PROTOCOL_ERROR', 'greeting');
            expectReply(await this.reader.next(), [220], 'greeting');
            this.capabilities = await this.ehlo();

            if (!this.encrypted) {
                const supportsStartTls = this.capabilities.some(line => line.startsWith('STARTTLS'));
                if (supportsStartTls) {
                    await this.command('STARTTLS', [220], 'tls');
                    const plainSocket = this.socket as net.Socket;
                    this.reader?.dispose();
                    this.reader = null;
                    this.socket = null;
                    this.setSocket(await connectSecure(this.config, plainSocket), true);
                    this.capabilities = await this.ehlo();
                } else if (this.config.requireTls) {
                    throw new SmtpServiceError('SMTP_TLS_REQUIRED', 'tls');
                }
            }

            await this.authenticate();
        } catch (error) {
            this.close();
            throw mapTransportError(error, 'connect');
        }
    }

    getInfo() {
        return {
            secure: this.encrypted,
            authenticated: Boolean(this.config.user),
            capabilities: this.capabilities
                .map(line => line.split(/\s+/)[0])
                .filter((value, index, all) => value && all.indexOf(value) === index)
                .slice(0, 20),
        };
    }

    async send(envelopeFrom: string, recipients: string[], message: string): Promise<string> {
        await this.command(`MAIL FROM:<${safeCommandArgument(envelopeFrom, 'sender')}>`, [250], 'sender');
        for (const recipient of recipients) {
            await this.command(`RCPT TO:<${safeCommandArgument(recipient, 'recipient')}>`, [250, 251], 'recipient');
        }
        await this.command('DATA', [354], 'message');
        if (!this.socket || !this.reader) {
            throw new SmtpServiceError('SMTP_PROTOCOL_ERROR', 'message');
        }
        const dotStuffed = message
            .replace(/\r?\n/g, '\r\n')
            .replace(/(^|\r\n)\./g, '$1..');
        await writeSocket(this.socket, `${dotStuffed}\r\n.\r\n`);
        const accepted = expectReply(await this.reader.next(), [250], 'message');
        return cleanInline(accepted.lines[accepted.lines.length - 1], 200);
    }

    async quit(): Promise<void> {
        if (!this.socket || this.socket.destroyed) return;
        try {
            await this.command('QUIT', [221, 250], 'quit');
        } catch {
            // The message is already accepted; QUIT is best-effort.
        }
    }

    close(): void {
        this.reader?.dispose();
        this.reader = null;
        if (this.socket && !this.socket.destroyed) {
            this.socket.end();
            this.socket.destroy();
        }
        this.socket = null;
    }
}

function encodeHeader(value: string): string {
    const safe = cleanInline(value, 320);
    return /^[\x20-\x7e]*$/.test(safe)
        ? safe
        : `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`;
}

function base64Lines(value: string): string {
    const encoded = Buffer.from(value, 'utf8').toString('base64');
    return encoded.match(/.{1,76}/g)?.join('\r\n') || '';
}

function formatMailbox(name: string, email: string): string {
    return name ? `${encodeHeader(name)} <${email}>` : email;
}

function buildMimeMessage(config: SmtpConfig, input: SmtpMailMessage): {
    raw: string;
    envelopeFrom: string;
    recipients: string[];
    messageId: string;
} {
    const recipients = (Array.isArray(input.to) ? input.to : [input.to])
        .map(value => normalizeEmail(value, 'recipient'));
    const uniqueRecipients = [...new Set(recipients)].slice(0, 20);
    if (uniqueRecipients.length === 0) {
        throw new SmtpServiceError('SMTP_INVALID_ADDRESS', 'recipient');
    }

    const fromEmail = input.fromEmail
        ? normalizeEmail(input.fromEmail, 'sender')
        : config.fromEmail;
    const fromName = cleanInline(input.fromName, 120) || config.fromName;
    const subject = cleanInline(input.subject, 240);
    const textBody = String(input.text || '');
    const htmlBody = String(input.html || '');
    if (!subject || (!textBody && !htmlBody)) {
        throw new SmtpServiceError('SMTP_INVALID_CONFIG', 'message');
    }
    if (
        Buffer.byteLength(textBody, 'utf8') > MAX_MESSAGE_BYTES
        || Buffer.byteLength(htmlBody, 'utf8') > MAX_MESSAGE_BYTES
    ) {
        throw new SmtpServiceError('SMTP_INVALID_CONFIG', 'message');
    }

    const domain = fromEmail.split('@')[1].replace(/[^a-zA-Z0-9.-]/g, '') || 'localhost';
    const messageId = `<${Date.now()}.${crypto.randomBytes(12).toString('hex')}@${domain}>`;
    const headers = [
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: ${messageId}`,
        `From: ${formatMailbox(fromName, fromEmail)}`,
        `To: ${uniqueRecipients.join(', ')}`,
        `Subject: ${encodeHeader(subject)}`,
        'MIME-Version: 1.0',
    ];

    let body = '';
    if (textBody && htmlBody) {
        const boundary = `=_NemarkChat_${crypto.randomBytes(12).toString('hex')}`;
        headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
        body = [
            `--${boundary}`,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            base64Lines(textBody),
            `--${boundary}`,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            base64Lines(htmlBody),
            `--${boundary}--`,
        ].join('\r\n');
    } else {
        headers.push(`Content-Type: ${htmlBody ? 'text/html' : 'text/plain'}; charset=UTF-8`);
        headers.push('Content-Transfer-Encoding: base64');
        body = base64Lines(htmlBody || textBody);
    }

    return {
        raw: `${headers.join('\r\n')}\r\n\r\n${body}`,
        envelopeFrom: fromEmail,
        recipients: uniqueRecipients,
        messageId,
    };
}

export async function testSmtpConnection(config: SmtpConfig): Promise<{
    ok: true;
    latencyMs: number;
    secure: boolean;
    authenticated: boolean;
    capabilities: string[];
}> {
    const startedAt = Date.now();
    const session = new SmtpSession(config);
    try {
        await session.connect();
        const info = session.getInfo();
        await session.quit();
        return { ok: true, latencyMs: Date.now() - startedAt, ...info };
    } catch (error) {
        throw mapTransportError(error, 'connection-test');
    } finally {
        session.close();
    }
}

export async function sendSmtpMail(
    config: SmtpConfig,
    message: SmtpMailMessage,
): Promise<{ accepted: string[]; messageId: string; response: string }> {
    const mime = buildMimeMessage(config, message);
    const session = new SmtpSession(config);
    try {
        await session.connect();
        const response = await session.send(mime.envelopeFrom, mime.recipients, mime.raw);
        await session.quit();
        return {
            accepted: mime.recipients,
            messageId: mime.messageId,
            response,
        };
    } catch (error) {
        throw mapTransportError(error, 'send');
    } finally {
        session.close();
    }
}

function alertSmtpFailure(operation: string, error: unknown): void {
    const safe = toSafeSmtpError(error);
    void systemNotificationService.smtpFailure({
        operation,
        code: safe.code,
        phase: safe.phase,
        retryable: safe.retryable,
    });
}

export const smtpService = {
    resolveConfig: resolveSmtpConfig,

    async getPublicConfig() {
        try {
            const config = await resolveSmtpConfig();
            return {
                configured: true,
                enabled: config.enabled,
                host: config.host,
                port: config.port,
                secure: config.secure,
                requireTls: config.requireTls,
                user: config.user,
                hasPassword: Boolean(config.password),
                fromEmail: config.fromEmail,
                fromName: config.fromName,
                connectionTimeoutMs: config.connectionTimeoutMs,
                commandTimeoutMs: config.commandTimeoutMs,
                tlsRejectUnauthorized: config.tlsRejectUnauthorized,
            };
        } catch (error) {
            const safe = toSafeSmtpError(error);
            if (safe.code !== 'SMTP_NOT_CONFIGURED') throw error;
            return {
                configured: false,
                enabled: false,
                hasPassword: false,
            };
        }
    },

    async testConnection(overrides: SmtpConfigInput = {}) {
        try {
            return await testSmtpConnection(await resolveSmtpConfig(overrides));
        } catch (error) {
            alertSmtpFailure('connection_test', error);
            throw error;
        }
    },

    async sendMail(message: SmtpMailMessage, overrides: SmtpConfigInput = {}) {
        try {
            const config = await resolveSmtpConfig(overrides);
            if (!config.enabled) {
                throw new SmtpServiceError('SMTP_NOT_CONFIGURED', 'send');
            }
            return await sendSmtpMail(config, message);
        } catch (error) {
            alertSmtpFailure('send', error);
            throw error;
        }
    },

    async sendTestEmail(to: string, overrides: SmtpConfigInput = {}) {
        return this.sendMail({
            to,
            subject: 'NemarkChat SMTP test',
            text: [
                'Kết nối SMTP của NemarkChat đã hoạt động.',
                '',
                `Thời gian kiểm tra: ${new Date().toISOString()}`,
                'Nếu bạn không thực hiện kiểm tra này, hãy rà soát quyền truy cập quản trị.',
            ].join('\n'),
        }, overrides);
    },

    safeError: toSafeSmtpError,
};
