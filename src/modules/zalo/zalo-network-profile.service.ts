/* eslint-disable @typescript-eslint/no-explicit-any */
import dns from 'dns/promises';
import https from 'https';
import net from 'net';
import { ProxyAgent } from 'proxy-agent';
import { AppError } from '../../middlewares/errorHandler';
import { decryptSecret, encryptSecret } from '../../infra/secretVault';
import { zaloAccountRepo } from './repos/zalo-account.repo';
import { settingsService } from '../admin/settings.service';

export type ProxyProtocol = 'http' | 'https' | 'socks5';

export interface NetworkProfileInput {
    enabled?: boolean;
    protocol?: ProxyProtocol;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    expectedCountry?: string;
    staticAcknowledged?: boolean;
}

interface StoredNetworkProfile extends Omit<NetworkProfileInput, 'password'> {
    encryptedPassword?: string;
    updatedAt?: string;
    lastTest?: { ok: boolean; checkedAt: string; exitIp?: string; country?: string; error?: string };
}

function isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
            || a >= 224;
    }
    const value = ip.toLowerCase();
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd')
        || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
}

function publicProfile(value: unknown) {
    const profile = (value && typeof value === 'object' ? value : {}) as StoredNetworkProfile;
    return {
        enabled: profile.enabled === true,
        protocol: profile.protocol || 'http',
        host: profile.host || '',
        port: profile.port || 0,
        username: profile.username || '',
        expectedCountry: profile.expectedCountry || 'VN',
        staticAcknowledged: profile.staticAcknowledged === true,
        passwordConfigured: Boolean(profile.encryptedPassword),
        updatedAt: profile.updatedAt,
        lastTest: profile.lastTest,
        policy: 'one-static-proxy-per-account',
    };
}

async function validateEndpoint(host: string, port: number) {
    if (!host || host.length > 253 || /[\s/:?#]/.test(host)) {
        throw new AppError('Host proxy không hợp lệ; chỉ nhập hostname hoặc IP', 400, 'INVALID_PROXY_HOST');
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new AppError('Port proxy phải nằm trong khoảng 1-65535', 400, 'INVALID_PROXY_PORT');
    }
    if (host.toLowerCase() === 'localhost') {
        throw new AppError('Không cho phép proxy nội bộ', 400, 'PRIVATE_PROXY_HOST');
    }
    const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) {
        throw new AppError('Proxy phải trỏ tới IP public', 400, 'PRIVATE_PROXY_HOST');
    }
}

function proxyUrl(profile: StoredNetworkProfile): string {
    const username = String(profile.username || '');
    const password = profile.encryptedPassword ? decryptSecret(profile.encryptedPassword) : '';
    const auth = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
    return `${profile.protocol || 'http'}://${auth}${profile.host}:${profile.port}`;
}

async function ownedAccount(workspaceId: string, accountId: string) {
    const account = await zaloAccountRepo.findById(accountId);
    if (!account || String(account.workspaceId) !== workspaceId) {
        throw new AppError('Tài khoản Zalo không tồn tại', 404, 'NOT_FOUND');
    }
    return account as any;
}

function profileKey(workspaceId: string, accountId: string) {
    return `zalo_network_profile:${workspaceId}:${accountId}`;
}

async function readProfile(workspaceId: string, accountId: string): Promise<StoredNetworkProfile> {
    const raw = await settingsService.get(profileKey(workspaceId, accountId), '');
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export const zaloNetworkProfileService = {
    async remove(workspaceId: string, accountId: string) {
        await settingsService.set(profileKey(workspaceId, accountId), '');
    },

    async get(workspaceId: string, accountId: string) {
        await ownedAccount(workspaceId, accountId);
        return publicProfile(await readProfile(workspaceId, accountId));
    },

    async save(workspaceId: string, accountId: string, input: NetworkProfileInput) {
        await ownedAccount(workspaceId, accountId);
        const old = await readProfile(workspaceId, accountId);
        const enabled = input.enabled === true;
        const protocol = input.protocol || old.protocol || 'http';
        if (!['http', 'https', 'socks5'].includes(protocol)) {
            throw new AppError('Giao thức proxy không được hỗ trợ', 400, 'INVALID_PROXY_PROTOCOL');
        }
        const host = String(input.host ?? old.host ?? '').trim();
        const port = Number(input.port ?? old.port ?? 0);
        if (enabled) {
            if (input.staticAcknowledged !== true) {
                throw new AppError('Cần xác nhận dùng một proxy tĩnh cho tài khoản này', 400, 'STATIC_PROXY_REQUIRED');
            }
            await validateEndpoint(host, port);
        }
        const password = String(input.password || '');
        const stored: StoredNetworkProfile = {
            enabled, protocol, host, port,
            username: String(input.username ?? old.username ?? '').trim(),
            encryptedPassword: password ? encryptSecret(password) : old.encryptedPassword,
            expectedCountry: String(input.expectedCountry || old.expectedCountry || 'VN').trim().toUpperCase().slice(0, 2),
            staticAcknowledged: input.staticAcknowledged === true,
            updatedAt: new Date().toISOString(),
            lastTest: old.lastTest,
        };
        await settingsService.set(profileKey(workspaceId, accountId), JSON.stringify(stored));
        return publicProfile(stored);
    },

    async test(workspaceId: string, accountId: string) {
        await ownedAccount(workspaceId, accountId);
        const profile = await readProfile(workspaceId, accountId);
        if (!profile.enabled || !profile.host || !profile.port) {
            throw new AppError('Network Profile chưa được bật', 400, 'NETWORK_PROFILE_DISABLED');
        }
        await validateEndpoint(String(profile.host), Number(profile.port));
        const configuredProxyUrl = proxyUrl(profile);
        const agent = new ProxyAgent({ getProxyForUrl: () => configuredProxyUrl });
        const result = await new Promise<{ exitIp?: string; country?: string }>((resolve, reject) => {
            const request = https.get('https://www.cloudflare.com/cdn-cgi/trace', { agent, timeout: 12_000 }, response => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', chunk => { body += chunk; });
                response.on('end', () => {
                    if ((response.statusCode || 500) >= 400) return reject(new Error(`HTTP ${response.statusCode}`));
                    const fields = Object.fromEntries(body.split('\n').map(line => line.split('=', 2)).filter(item => item.length === 2));
                    resolve({ exitIp: fields.ip, country: fields.loc });
                });
            });
            request.on('timeout', () => request.destroy(new Error('Hết thời gian kiểm tra proxy')));
            request.on('error', reject);
        });
        const expected = String(profile.expectedCountry || '').toUpperCase();
        const ok = !expected || !result.country || expected === result.country.toUpperCase();
        const lastTest = {
            ok, checkedAt: new Date().toISOString(), exitIp: result.exitIp, country: result.country,
            ...(!ok ? { error: `IP thoát ở ${result.country}, khác khu vực mong đợi ${expected}` } : {}),
        };
        await settingsService.set(profileKey(workspaceId, accountId), JSON.stringify({ ...profile, lastTest }));
        return lastTest;
    },

    async transportForAccount(account: any) {
        const workspaceId = String(account?.workspaceId || '');
        const accountId = String(account?.id || '');
        if (!workspaceId || !accountId) return undefined;
        const profile = await readProfile(workspaceId, accountId);
        if (!profile.enabled || !profile.host || !profile.port) return undefined;
        const configuredProxyUrl = proxyUrl(profile);
        return { agent: new ProxyAgent({ getProxyForUrl: () => configuredProxyUrl }) };
    },
};
