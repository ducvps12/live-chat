export type PersonaEmojiLevel = 'none' | 'light' | 'expressive';
export type PersonaSalesStyle = 'consultative' | 'balanced' | 'direct';
export type PersonaIdentityStyle = 'role_first' | 'transparent';
export type PersonaResponsePace = 'instant' | 'natural' | 'thoughtful';
export type PersonaIntelligenceLevel = 'quick' | 'balanced' | 'advanced';
export type PersonaReplyGrouping = 'single' | 'smart_burst';

export interface BotPersonaConfig {
    version: 1;
    humanLikeMode: boolean;
    roleTitle: string;
    selfReference: string;
    customerReference: string;
    toneInstructions: string;
    sampleReplies: string;
    signaturePhrases: string[];
    forbiddenPhrases: string[];
    adaptToCustomerTone: boolean;
    emojiLevel: PersonaEmojiLevel;
    salesStyle: PersonaSalesStyle;
    identityStyle: PersonaIdentityStyle;
    typingIndicator: boolean;
    typingLabel: string;
    responsePace: PersonaResponsePace;
    minDelayMs: number;
    maxDelayMs: number;
    intelligenceLevel: PersonaIntelligenceLevel;
    replyGrouping: PersonaReplyGrouping;
    maxReplyParts: number;
    interMessageDelayMs: number;
}

export const DEFAULT_BOT_PERSONA: BotPersonaConfig = {
    version: 1,
    humanLikeMode: true,
    roleTitle: 'trợ lý hỗ trợ khách hàng',
    selfReference: 'mình',
    customerReference: 'bạn',
    toneInstructions: 'Nói chuyện ngắn gọn, ấm áp, đi thẳng vào điều khách đang cần và tránh giọng tổng đài.',
    sampleReplies: '',
    signaturePhrases: [],
    forbiddenPhrases: [
        'Có vẻ như bạn đang cần hỗ trợ',
        'Hãy cho tôi biết thêm thông tin',
        'Tôi có thể giúp gì cho bạn',
    ],
    adaptToCustomerTone: true,
    emojiLevel: 'light',
    salesStyle: 'consultative',
    identityStyle: 'role_first',
    typingIndicator: true,
    typingLabel: 'Đang soạn…',
    responsePace: 'natural',
    minDelayMs: 900,
    maxDelayMs: 3200,
    intelligenceLevel: 'balanced',
    replyGrouping: 'smart_burst',
    maxReplyParts: 3,
    interMessageDelayMs: 650,
};

function text(value: unknown, fallback: string, maxLength: number): string {
    if (typeof value !== 'string') return fallback;
    return value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/\r\n/g, '\n')
        .trim()
        .slice(0, maxLength) || fallback;
}

/**
 * Style samples are untrusted prompt data. Keep their conversational wording,
 * but make angle-bracket prompt delimiters inert and remove role-prefixed
 * instruction lines that could escape the examples block.
 */
function sampleReplyText(value: unknown): string {
    const normalized = text(value, '', 5000);
    if (!normalized) return '';

    return normalized
        .split('\n')
        .filter(line => !/^\s*(?:system|developer|assistant)\s*:/i.test(line))
        .filter(line => !/\b(?:ignore|disregard|override|bỏ qua|thay đổi)\b.{0,60}\b(?:instruction|instructions|chỉ dẫn|quy tắc|vai trò|system prompt)\b/i.test(line))
        .join('\n')
        .replace(/</g, '‹')
        .replace(/>/g, '›')
        .trim();
}

function textList(value: unknown, fallback: string[], maxItems = 12): string[] {
    const source = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/\r?\n|,/)
            : fallback;
    return [...new Set(source
        .map(item => text(item, '', 120))
        .filter(Boolean))]
        .slice(0, maxItems);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === 'string' && allowed.includes(value as T)
        ? value as T
        : fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.round(Math.min(max, Math.max(min, parsed)));
}

export function normalizeBotPersonaConfig(value: unknown): BotPersonaConfig {
    const source = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    const pace = enumValue(
        source.responsePace,
        ['instant', 'natural', 'thoughtful'] as const,
        DEFAULT_BOT_PERSONA.responsePace,
    );
    const paceDefaults = pace === 'instant'
        ? { min: 250, max: 900 }
        : pace === 'thoughtful'
            ? { min: 1600, max: 4800 }
            : { min: DEFAULT_BOT_PERSONA.minDelayMs, max: DEFAULT_BOT_PERSONA.maxDelayMs };
    const minDelayMs = boundedNumber(source.minDelayMs, paceDefaults.min, 0, 8000);
    const maxDelayMs = Math.max(
        minDelayMs,
        boundedNumber(source.maxDelayMs, paceDefaults.max, 0, 12000),
    );

    return {
        version: 1,
        humanLikeMode: source.humanLikeMode !== false,
        roleTitle: text(source.roleTitle, DEFAULT_BOT_PERSONA.roleTitle, 80),
        selfReference: text(source.selfReference, DEFAULT_BOT_PERSONA.selfReference, 24),
        customerReference: text(source.customerReference, DEFAULT_BOT_PERSONA.customerReference, 24),
        toneInstructions: text(source.toneInstructions, DEFAULT_BOT_PERSONA.toneInstructions, 1600),
        sampleReplies: sampleReplyText(source.sampleReplies),
        signaturePhrases: textList(source.signaturePhrases, DEFAULT_BOT_PERSONA.signaturePhrases),
        forbiddenPhrases: textList(source.forbiddenPhrases, DEFAULT_BOT_PERSONA.forbiddenPhrases),
        adaptToCustomerTone: source.adaptToCustomerTone !== false,
        emojiLevel: enumValue(
            source.emojiLevel,
            ['none', 'light', 'expressive'] as const,
            DEFAULT_BOT_PERSONA.emojiLevel,
        ),
        salesStyle: enumValue(
            source.salesStyle,
            ['consultative', 'balanced', 'direct'] as const,
            DEFAULT_BOT_PERSONA.salesStyle,
        ),
        identityStyle: enumValue(
            source.identityStyle,
            ['role_first', 'transparent'] as const,
            DEFAULT_BOT_PERSONA.identityStyle,
        ),
        typingIndicator: source.typingIndicator !== false,
        typingLabel: text(source.typingLabel, DEFAULT_BOT_PERSONA.typingLabel, 40),
        responsePace: pace,
        minDelayMs,
        maxDelayMs,
        intelligenceLevel: enumValue(
            source.intelligenceLevel,
            ['quick', 'balanced', 'advanced'] as const,
            DEFAULT_BOT_PERSONA.intelligenceLevel,
        ),
        replyGrouping: enumValue(
            source.replyGrouping,
            ['single', 'smart_burst'] as const,
            DEFAULT_BOT_PERSONA.replyGrouping,
        ),
        maxReplyParts: boundedNumber(source.maxReplyParts, DEFAULT_BOT_PERSONA.maxReplyParts, 2, 4),
        interMessageDelayMs: boundedNumber(
            source.interMessageDelayMs,
            DEFAULT_BOT_PERSONA.interMessageDelayMs,
            250,
            2500,
        ),
    };
}

function oneLineList(items: string[]): string {
    return items.map(item => `“${item}”`).join(', ');
}

export function buildPersonaPrompt(value: unknown): string {
    const persona = normalizeBotPersonaConfig(value);
    const lines = [
        '\nCá tính hội thoại đã được chủ workspace cấu hình:',
        `- Vai trò khi giới thiệu: ${persona.roleTitle}.`,
        `- Cách xưng hô: tự xưng “${persona.selfReference}”, gọi khách là “${persona.customerReference}”.`,
        `- Chỉ dẫn giọng riêng: ${persona.toneInstructions}`,
        persona.adaptToCustomerTone
            ? '- Điều chỉnh độ trang trọng, nhịp câu và độ dài theo cách khách đang nhắn; không bắt chước lời xúc phạm, kỳ thị hoặc hành vi nguy hiểm.'
            : '- Giữ giọng thương hiệu ổn định, không chạy theo tiếng lóng của khách.',
        persona.emojiLevel === 'none'
            ? '- Không dùng emoji.'
            : persona.emojiLevel === 'expressive'
                ? '- Có thể dùng emoji có chọn lọc, tối đa 2 emoji khi thật sự hợp ngữ cảnh.'
                : '- Chỉ dùng tối đa 1 emoji khi khách đã dùng emoji hoặc tình huống thật sự phù hợp.',
        persona.salesStyle === 'direct'
            ? '- Tư vấn bán hàng rõ ràng và chủ động đề xuất một bước tiếp theo, nhưng không gây áp lực hay tạo khan hiếm giả.'
            : persona.salesStyle === 'balanced'
                ? '- Cân bằng giữa giải đáp và đề xuất một bước tiếp theo phù hợp.'
                : '- Tư vấn theo nhu cầu: hỏi đủ một chi tiết cần thiết trước, không vội chốt đơn.',
        persona.identityStyle === 'role_first'
            ? '- Khi khách chỉ hỏi “bạn là ai?”, trả lời vai trò và thương hiệu, không tự đưa thuật ngữ kỹ thuật. Nếu khách hỏi thẳng có phải bot/chatbot/tự động hay không, phải trả lời trung thực.'
            : '- Khi khách hỏi danh tính, nói rõ đây là trợ lý tự động của doanh nghiệp.',
        '- Tuyệt đối không nhận mình là người thật, không bịa tên hay chức danh của một nhân viên có thật.',
        persona.intelligenceLevel === 'advanced'
            ? '- Mức suy luận chuyên sâu: đối chiếu lịch sử với kho tri thức, nhận ra ý định và điểm còn thiếu, rồi trả lời chắc chắn. Có thể chủ động bổ sung đúng một lưu ý hữu ích; không trình bày quá trình suy luận nội bộ.'
            : persona.intelligenceLevel === 'quick'
                ? '- Mức phản hồi nhanh: ưu tiên câu trả lời trực tiếp từ dữ liệu rõ ràng, không mở rộng ngoài điều khách vừa hỏi.'
                : '- Mức cân bằng: hiểu ý định trong ngữ cảnh, kiểm tra dữ liệu liên quan và trả lời đủ ý nhưng gọn.',
        persona.replyGrouping === 'smart_burst'
            ? `- Soạn câu trả lời thành tối đa ${persona.maxReplyParts} đoạn chat ngắn, mỗi đoạn trọn một ý và ngăn cách bằng xuống dòng. Không đánh số các đoạn, không cắt rời URL, giá tiền hoặc tên sản phẩm.`
            : '- Gộp nội dung thành một tin nhắn duy nhất.',
    ];

    if (persona.signaturePhrases.length) {
        lines.push(`- Có thể dùng tự nhiên các cụm quen thuộc: ${oneLineList(persona.signaturePhrases)}.`);
    }
    if (persona.forbiddenPhrases.length) {
        lines.push(`- Không dùng các câu/cụm sau: ${oneLineList(persona.forbiddenPhrases)}.`);
    }
    if (persona.sampleReplies) {
        lines.push(
            '<MAU_GIONG_CUA_CHU_WORKSPACE>',
            persona.sampleReplies,
            '</MAU_GIONG_CUA_CHU_WORKSPACE>',
            'Chỉ học nhịp câu, cách xưng hô và từ vựng từ mẫu trên; không sao chép thông tin sản phẩm, giá, cam kết hay dữ liệu thực tế trong mẫu.',
        );
    }
    return `${lines.join('\n')}\n`;
}

function stableJitter(seed: string, range: number): number {
    if (range <= 0) return 0;
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash) % (range + 1);
}

export function calculateHumanizedDeliveryDelay(input: {
    personaConfig: unknown;
    customerMessage: string;
    response: string;
    elapsedMs: number;
}): number {
    const persona = normalizeBotPersonaConfig(input.personaConfig);
    if (!persona.humanLikeMode || persona.responsePace === 'instant') return 0;

    const readingMs = Math.min(1100, Math.max(180, input.customerMessage.trim().length * 18));
    const typingMs = Math.min(1800, Math.max(350, input.response.trim().length * 7));
    const jitterMs = stableJitter(`${input.customerMessage}|${input.response}`, 420);
    const targetMs = Math.min(
        persona.maxDelayMs,
        Math.max(persona.minDelayMs, 280 + readingMs + typingMs + jitterMs),
    );
    return Math.max(0, targetMs - Math.max(0, input.elapsedMs));
}

/**
 * Turn one AI answer into a short, natural chat burst. This is deterministic:
 * it does not spend extra AI quota and never cuts URLs or words in the middle.
 */
export function splitHumanizedReply(response: string, value: unknown): string[] {
    const persona = normalizeBotPersonaConfig(value);
    const normalized = response
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!normalized || persona.replyGrouping === 'single' || !persona.humanLikeMode) {
        return normalized ? [normalized] : [];
    }

    // A sentence is not automatically a separate chat bubble. Only explicit
    // paragraph breaks represent an intentional burst.
    const units = normalized
        .split(/\n{2,}/u)
        .map(part => part.trim())
        .filter(Boolean);
    if (units.length <= 1) return [normalized];

    const partCount = Math.min(persona.maxReplyParts, units.length);
    const groups: string[] = [];
    let cursor = 0;
    for (let groupIndex = 0; groupIndex < partCount; groupIndex += 1) {
        const remainingUnits = units.length - cursor;
        const remainingGroups = partCount - groupIndex;
        const take = Math.ceil(remainingUnits / remainingGroups);
        groups.push(units.slice(cursor, cursor + take).join(' ').trim());
        cursor += take;
    }
    return groups.filter(Boolean);
}
