import { AppError } from '../../middlewares/errorHandler';
import { decryptSecret, encryptSecret, isEncryptedSecret } from '../../infra/secretVault';

export const SHOPEE_AFFILIATE_ACTION = 'shopee_affiliate_link_v1';

const SHOPEE_HOSTS = new Set(['shopee.vn', 'www.shopee.vn', 's.shopee.vn']);
const URL_RE = /https:\/\/(?:www\.)?shopee\.vn\/[^\s]+|https:\/\/s\.shopee\.vn\/[^\s]+/i;

export interface ShopeeAffiliateActionData {
    affiliateId?: string;
    subId?: string;
    disclosure?: string;
    encryptedAffiliateId?: string;
}

export function extractShopeeUrl(message: string): string | null {
    const match = String(message || '').match(URL_RE);
    if (!match) return null;
    try {
        const url = new URL(match[0]);
        if (url.protocol !== 'https:' || !SHOPEE_HOSTS.has(url.hostname.toLowerCase())) return null;
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

export function protectShopeeActionData(value: unknown, previous?: unknown): ShopeeAffiliateActionData {
    const input = (value && typeof value === 'object' ? value : {}) as ShopeeAffiliateActionData;
    const old = (previous && typeof previous === 'object' ? previous : {}) as ShopeeAffiliateActionData;
    const rawAffiliateId = String(input.affiliateId || '').trim();
    const encryptedAffiliateId = rawAffiliateId
        ? encryptSecret(rawAffiliateId)
        : (input.encryptedAffiliateId || old.encryptedAffiliateId || '');

    return {
        encryptedAffiliateId,
        subId: String(input.subId || old.subId || '').trim().slice(0, 100),
        disclosure: String(input.disclosure || old.disclosure || 'Link này có thể là link tiếp thị liên kết; bạn không phải trả thêm chi phí.').trim().slice(0, 300),
    };
}

export function publicShopeeActionData(value: unknown): Record<string, unknown> {
    const data = (value && typeof value === 'object' ? value : {}) as ShopeeAffiliateActionData;
    return {
        subId: data.subId || '',
        disclosure: data.disclosure || '',
        hasAffiliateId: Boolean(data.encryptedAffiliateId),
    };
}

export function buildShopeeAffiliateReply(message: string, value: unknown): string {
    const sourceUrl = extractShopeeUrl(message);
    if (!sourceUrl) throw new AppError('Chỉ hỗ trợ link https thuộc shopee.vn hoặc s.shopee.vn', 400, 'INVALID_SHOPEE_URL');

    const data = (value && typeof value === 'object' ? value : {}) as ShopeeAffiliateActionData;
    const stored = String(data.encryptedAffiliateId || '').trim();
    const affiliateId = stored ? decryptSecret(stored) : String(data.affiliateId || '').trim();
    if (!affiliateId) throw new AppError('Template chưa có Affiliate ID', 400, 'MISSING_AFFILIATE_ID');

    const redirect = new URL('https://s.shopee.vn/an_redir');
    redirect.searchParams.set('origin_link', sourceUrl);
    redirect.searchParams.set('affiliate_id', affiliateId);
    if (data.subId) redirect.searchParams.set('sub_id', data.subId);

    const disclosure = String(data.disclosure || 'Link này có thể là link tiếp thị liên kết; bạn không phải trả thêm chi phí.').trim();
    return `Mình tạo link mua hàng cho bạn đây:\n${redirect.toString()}\n\n${disclosure}`;
}

export function isProtectedAffiliateSecret(value: unknown): boolean {
    const data = (value && typeof value === 'object' ? value : {}) as ShopeeAffiliateActionData;
    return Boolean(data.encryptedAffiliateId && isEncryptedSecret(data.encryptedAffiliateId));
}
