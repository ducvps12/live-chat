import { normalizeBotPersonaConfig } from './persona-config';
import { SHOPEE_AFFILIATE_ACTION, protectShopeeActionData } from './shopee-affiliate-action';

export const ZALO_SHOPEE_TEMPLATE_KEY = 'zalo-shopee-affiliate-v1';

export interface ZaloShopeeTemplateInput {
    name?: string;
    brandName?: string;
    affiliateId: string;
    subId?: string;
    disclosure?: string;
}

export const botTemplates = [{
    key: ZALO_SHOPEE_TEMPLATE_KEY,
    name: 'Zalo · Shopee Affiliate',
    version: 1,
    channel: 'zalo',
    description: 'Nhận link Shopee từ khách, tạo link affiliate có disclosure và bàn giao agent khi cần.',
    safeguards: [
        'Chỉ xử lý link HTTPS thuộc Shopee Việt Nam',
        'Affiliate ID được mã hoá trước khi lưu',
        'Không cam kết hoàn tiền, hoa hồng hoặc trạng thái đơn',
        'Không tự gửi hàng loạt và không hoạt động trong nhóm',
    ],
}];

export function buildZaloShopeeBot(input: ZaloShopeeTemplateInput) {
    const actionData = protectShopeeActionData(input);
    return {
        name: String(input.name || 'Trợ lý link Shopee').trim(),
        brandName: String(input.brandName || 'Shop').trim(),
        brandDescription: 'Hỗ trợ khách tạo link mua hàng Shopee minh bạch và chuyển nhân viên khi cần kiểm tra đơn.',
        mainTask: 'customer_care',
        conversationStyle: 'friendly',
        messageLength: 'short',
        customGreeting: 'Bạn gửi mình link sản phẩm Shopee cần kiểm tra nhé.',
        welcomeMessage: 'Gửi link Shopee, mình tạo link mua hàng giúp bạn ngay.',
        channels: {
            website: { enabled: false }, messenger: { enabled: false }, facebook: { enabled: false },
            zalo: { enabled: true }, instagram: { enabled: false },
        },
        agentCondition: 'no_condition',
        scenarios: [{
            trigger: 'https:\\/\\/(?:www\\.)?shopee\\.vn\\/\\S+|https:\\/\\/s\\.shopee\\.vn\\/\\S+',
            triggerType: 'regex',
            response: 'Mình đang tạo link mua hàng cho bạn.',
            action: SHOPEE_AFFILIATE_ACTION,
            actionData,
            priority: 1000,
        }],
        quickReplies: [
            { label: 'Cách gửi link', value: 'Bạn sao chép link sản phẩm trên Shopee rồi gửi trực tiếp vào đây nhé.' },
            { label: 'Gặp nhân viên', value: 'Mình cần nhân viên hỗ trợ.' },
        ],
        followUp: { enabled: false, delaySeconds: 60, message: '' },
        personaConfig: normalizeBotPersonaConfig({
            humanLikeMode: true,
            roleTitle: 'trợ lý hỗ trợ khách hàng',
            selfReference: 'mình', customerReference: 'bạn',
            toneInstructions: 'Nói ngắn gọn, tự nhiên, không hứa hoàn tiền hoặc xác nhận đơn hàng.',
            typingIndicator: true, responsePace: 'natural', minDelayMs: 700, maxDelayMs: 1800,
        }),
        isActive: false,
        isDraft: true,
    };
}
