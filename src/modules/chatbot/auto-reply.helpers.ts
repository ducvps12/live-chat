import { normalizeBotPersonaConfig } from './persona-config';

export type AutoReplyAgentCondition =
    | 'always'
    | 'no_agent_online'
    | 'at_least_one_online'
    | 'no_condition';

export interface AutoReplyHistoryMessage {
    id?: string;
    _id?: string | { toString(): string };
    senderType?: string;
    content?: string | null;
    type?: string | null;
    isDeleted?: boolean | null;
    isInternal?: boolean | null;
    createdAt?: Date | string | number | null;
}

export interface LatestOnlyWorkerResult<T> {
    replacement?: T;
    retryAfterMs?: number;
}

export interface LatestOnlyWorker<T> {
    enqueue(key: string, payload: T): void;
    waitForIdle(key: string): Promise<void>;
    hasPending(key: string): boolean;
    clear(key: string): void;
}

export interface LatestOnlyWorkerOptions {
    debounceMs?: number;
    errorRetryMs?: number;
    onError?: (error: unknown, key: string) => void;
}

export interface AutoReplyPolicyInput {
    agentCondition?: string | null;
    assignedTo?: unknown;
    metadata?: unknown;
    onlineAgentCount?: number;
}

export interface AutoReplyPolicyDecision {
    allowed: boolean;
    reason:
        | 'allowed'
        | 'assigned_to_human'
        | 'human_takeover'
        | 'agent_online'
        | 'no_agent_online';
}

const TAKEOVER_MODES = new Set(['human', 'agent', 'manual', 'paused', 'disabled', 'off']);

/**
 * Sender identity is controlled by the server; client message ids are not.
 * Keep the automation boundary in one place so a client cannot bypass human
 * takeover by choosing an AI-looking idempotency key.
 */
export function isHumanAgentSender(senderType: string, senderId: unknown): boolean {
    if (senderType !== 'agent') return false;
    const id = String(senderId || '').trim().toLowerCase();
    return id !== 'ai'
        && id !== 'assistant'
        && !id.startsWith('bot_')
        && !id.startsWith('ai_');
}

function objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function hasAssignment(assignedTo: unknown): boolean {
    if (typeof assignedTo === 'string') return assignedTo.trim().length > 0;
    return Boolean(assignedTo);
}

function hasExplicitHumanTakeover(metadata: unknown): boolean {
    const data = objectValue(metadata);
    const booleanFlags = [
        data.aiPaused,
        data.botPaused,
        data.humanTakeover,
        data.aiTakeover,
        data.autoReplyDisabled,
    ];
    if (booleanFlags.some(value => value === true)) return true;
    if (data.autoReplyEnabled === false) return true;

    const modes = [data.aiMode, data.takeoverMode, data.handoffMode];
    return modes.some(value => (
        typeof value === 'string' && TAKEOVER_MODES.has(value.trim().toLowerCase())
    ));
}

/**
 * Central policy for the AI auto-reply/human handoff boundary.
 * `always` and `no_condition` intentionally do not inspect recent agent messages.
 */
export function evaluateAutoReplyPolicy(input: AutoReplyPolicyInput): AutoReplyPolicyDecision {
    if (hasAssignment(input.assignedTo)) {
        return { allowed: false, reason: 'assigned_to_human' };
    }
    if (hasExplicitHumanTakeover(input.metadata)) {
        return { allowed: false, reason: 'human_takeover' };
    }

    const condition = (input.agentCondition || 'no_condition') as AutoReplyAgentCondition;
    const onlineAgentCount = Math.max(0, input.onlineAgentCount || 0);
    if (condition === 'no_agent_online' && onlineAgentCount > 0) {
        return { allowed: false, reason: 'agent_online' };
    }
    if (condition === 'at_least_one_online' && onlineAgentCount === 0) {
        return { allowed: false, reason: 'no_agent_online' };
    }

    return { allowed: true, reason: 'allowed' };
}

function getMessageId(message: AutoReplyHistoryMessage): string {
    if (message.id) return String(message.id);
    if (message._id) return String(message._id);
    return '';
}

function messageTimestamp(message: AutoReplyHistoryMessage): number {
    if (!message.createdAt) return 0;
    const timestamp = new Date(message.createdAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Produces a bounded, chronological text-only context and removes the current
 * message by its stable id (never by matching content).
 */
export function buildAutoReplyHistory(
    messages: AutoReplyHistoryMessage[],
    currentMessageId: string,
    limit = 12,
): Array<{ role: 'user' | 'assistant'; content: string }> {
    const safeLimit = Math.min(12, Math.max(1, limit));
    const ordered = messages
        .map((message, index) => ({ message, index }))
        .sort((left, right) => {
            const timeDifference = messageTimestamp(left.message) - messageTimestamp(right.message);
            return timeDifference || left.index - right.index;
        });
    const currentIndex = currentMessageId
        ? ordered.findIndex(({ message }) => getMessageId(message) === currentMessageId)
        : ordered.length;

    // If the bounded DB snapshot no longer contains the target, returning no
    // history is safer than placing newer messages before an older current turn.
    if (currentMessageId && currentIndex < 0) return [];

    return ordered
        .slice(0, currentIndex)
        .filter(({ message }) => {
            if (message.isDeleted || message.isInternal || message.type !== 'text') return false;
            if (message.senderType !== 'visitor' && message.senderType !== 'agent') return false;
            return typeof message.content === 'string' && message.content.trim().length > 0;
        })
        .slice(-safeLimit)
        .map(({ message }) => ({
            role: message.senderType === 'visitor' ? 'user' : 'assistant',
            content: message.content!.trim(),
        }));
}

/**
 * Small in-memory latest-only worker used to debounce bursty inbound messages.
 * If B arrives while A is running, A's handler can observe `isLatest() === false`
 * and the worker immediately runs B afterwards. Errors retry the same latest item.
 */
export function createLatestOnlyWorker<T>(
    handler: (
        key: string,
        payload: T,
        isLatest: () => boolean,
    ) => Promise<void | LatestOnlyWorkerResult<T>>,
    options: LatestOnlyWorkerOptions = {},
): LatestOnlyWorker<T> {
    interface State {
        latest: T;
        revision: number;
        running: boolean;
        timer?: ReturnType<typeof setTimeout>;
        idleWaiters: Array<() => void>;
    }

    const states = new Map<string, State>();
    const debounceMs = Math.max(0, options.debounceMs ?? 300);
    const errorRetryMs = Math.max(1, options.errorRetryMs ?? 1_000);

    const resolveIdle = (state: State) => {
        for (const resolve of state.idleWaiters.splice(0)) resolve();
    };

    const schedule = (key: string, state: State, delayMs: number) => {
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => {
            state.timer = undefined;
            void drain(key, state);
        }, Math.max(0, delayMs));
    };

    const drain = async (key: string, state: State): Promise<void> => {
        if (state.running || states.get(key) !== state) return;
        state.running = true;

        try {
            while (states.get(key) === state) {
                const revision = state.revision;
                const payload = state.latest;
                let result: void | LatestOnlyWorkerResult<T>;

                try {
                    result = await handler(key, payload, () => (
                        states.get(key) === state && state.revision === revision
                    ));
                } catch (error) {
                    try { options.onError?.(error, key); } catch { /* logging must not break retry */ }
                    if (states.get(key) !== state) return;
                    if (state.revision !== revision) continue;
                    state.running = false;
                    schedule(key, state, errorRetryMs);
                    return;
                }

                // `clear(key)` followed by a fresh enqueue creates a new state
                // for the same key. The old in-flight drain must never delete or
                // reschedule that replacement state (ABA protection).
                if (states.get(key) !== state) return;

                // A newer enqueue always wins over a replacement discovered by this run.
                if (state.revision !== revision) continue;

                if (result && Object.prototype.hasOwnProperty.call(result, 'replacement')) {
                    state.latest = result.replacement as T;
                    state.revision += 1;
                    continue;
                }

                if (result && result.retryAfterMs && result.retryAfterMs > 0) {
                    state.running = false;
                    schedule(key, state, result.retryAfterMs);
                    return;
                }

                states.delete(key);
                resolveIdle(state);
                return;
            }
        } finally {
            state.running = false;
        }
    };

    return {
        enqueue(key: string, payload: T) {
            let state = states.get(key);
            if (!state) {
                state = { latest: payload, revision: 0, running: false, idleWaiters: [] };
                states.set(key, state);
            }

            state.latest = payload;
            state.revision += 1;
            if (!state.running) schedule(key, state, debounceMs);
        },

        waitForIdle(key: string) {
            const state = states.get(key);
            if (!state) return Promise.resolve();
            return new Promise<void>(resolve => state.idleWaiters.push(resolve));
        },

        hasPending(key: string) {
            return states.has(key);
        },

        clear(key: string) {
            const state = states.get(key);
            if (!state) return;
            if (state.timer) clearTimeout(state.timer);
            states.delete(key);
            resolveIdle(state);
        },
    };
}

export type ConversationTurnIntent =
    | 'identity_question'
    | 'product_inquiry'
    | 'objection'
    | 'thanks'
    | 'greeting'
    | 'acknowledgement'
    | 'frustration'
    | 'confusion'
    | 'low_signal'
    | 'general';

export type AutoReplyGuardReason =
    | 'empty'
    | 'prompt_leak'
    | 'internal_policy'
    | 'forbidden_phrase'
    | 'hallucinated_external_topic'
    | 'repeated_clarification'
    | 'duplicate';

export interface AutoReplyGuardResult {
    allowed: boolean;
    response: string;
    reason?: AutoReplyGuardReason;
}

export type IdentityQuestionKind = 'role' | 'automation';

const LOW_SIGNAL_ACKNOWLEDGEMENTS = new Set([
    'u', 'um', 'uh', 'uk', 'ok', 'oke', 'okay', 'da', 'vang',
    'roi', 'da vang', 'vang a', 'da dung', 'da duoc', 'duoc', 'chuan',
]);
const LOW_SIGNAL_THANKS = new Set([
    'cam on', 'cam on nha', 'da cam on', 'ok cam on', 'oke cam on',
    'thanks', 'thanks ad', 'thank you', 'thank ad', 'tks', 'thx', 'ty',
]);
const LOW_SIGNAL_GREETINGS = new Set([
    'hi', 'hello', 'hey', 'alo', 'chao', 'xin chao', 'he lo',
    'chao ad', 'ad oi', 'admin oi',
]);
const LOW_SIGNAL_FRUSTRATION = new Set([
    'vl', 'vcl', 'vai', 'vai lua', 'vai chuong', 'dm', 'dmm', 'det', 'cmn',
]);
const LOW_SIGNAL_CONFUSION = new Set([
    'ha', 'the', 'sao', 'vay', 'gi', 'gi vay', 'sao vay', 'the a', 'vay a',
    'the ha', 'vay ha',
]);
const LOW_SIGNAL_FILLERS = new Set([
    ...LOW_SIGNAL_ACKNOWLEDGEMENTS,
    ...LOW_SIGNAL_THANKS,
    ...LOW_SIGNAL_GREETINGS,
    ...LOW_SIGNAL_FRUSTRATION,
    ...LOW_SIGNAL_CONFUSION,
    'a', 'aa', 'oi', 'nha', 'nhe', 'ui', 'ad', 'admin', 'k', 'ko', 'dc', 'v',
]);

function compactConversationText(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[\p{Emoji}\p{Symbol}\p{Punctuation}]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function foldConversationText(value: string): string {
    return compactConversationText(value)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/đ/g, 'd');
}

export function isStickerOrMediaMessage(value: string): boolean {
    const raw = String(value || '').trim();
    if (!raw) return true;
    if (raw === '🎭 Sticker' || raw === '[Media/Sticker]' || raw === '[Hình ảnh]' || raw === '[Media]' || raw.includes('&#x2F;Sticker]')) return true;
    if (/^\[sticker:\d+:\d+:\d+\]$/i.test(raw)) return true;
    const folded = foldConversationText(raw);
    return /^(?:sticker|hinh anh|media|anh)$/.test(folded);
}

export function isLowSignalMessage(value: string): boolean {
    if (isStickerOrMediaMessage(value)) return true;
    const folded = foldConversationText(value);
    if (!folded) return true;
    if (folded.length === 1 && !/^\d$/.test(folded)) return true;
    if (folded.length <= 60 && /\b(?:cam on|thank you|thanks|tks|thx)\b/.test(folded)) return true;
    if (/^(?:hi|hello|hey|alo|chao|xin chao|he lo)(?: shop| ad| admin| ban)?$/.test(folded)) return true;
    if (/^(?:u|um|uh|uk|ok|oke|okay|da|vang|roi|duoc|chuan)(?: nha| a| ban| shop)?$/.test(folded)) return true;
    return LOW_SIGNAL_FILLERS.has(folded);
}

export function detectIdentityQuestionKind(value: string): IdentityQuestionKind | null {
    const raw = String(value || '').trim();
    const folded = foldConversationText(raw);
    if (!folded) return null;

    const explicitAutomation = /\bAI\b/.test(raw)
        || /\b(?:bot|chatbot|robot|tro ly tu dong|tu dong tra loi|may tra loi|nguoi that)\b/.test(folded);
    if (explicitAutomation) return 'automation';

    const asksRole = /^(?:(?:may|ban|shop|ad|admin|em|anh|chi)\s+)?(?:la\s+)?ai(?:\s+(?:a|ha|day|do|vay))?$/.test(folded)
        || /^(?:ai\s+(?:day|do|vay)|ten\s+gi|ben\s+nao)(?:\s+(?:a|ha|vay))?$/.test(folded)
        || /\b(?:dang\s+)?(?:chat|noi chuyen)\s+voi\s+ai\b/.test(folded);
    return asksRole ? 'role' : null;
}

function isMeaningfulCustomerTurn(value: string): boolean {
    const folded = foldConversationText(value);
    if (!folded || isLowSignalMessage(value)) return false;
    return /[a-z0-9]/.test(folded) && folded.length >= 2;
}

export function detectConversationTurnIntent(value: string): ConversationTurnIntent {
    if (isStickerOrMediaMessage(value)) {
        return 'greeting';
    }
    const folded = foldConversationText(value);
    if (detectIdentityQuestionKind(value)) {
        return 'identity_question';
    }
    if (LOW_SIGNAL_THANKS.has(folded) || /\b(?:cam on|thank you|thanks)\b/.test(folded)) {
        return 'thanks';
    }
    if (/^(?:hi|hello|hey|alo|chao|xin chao|he lo)(?: shop| ad| admin| ban)?$/.test(folded)) {
        return 'greeting';
    }
    if (/^(?:u|um|uh|uk|ok|oke|okay|da|vang|roi|duoc|chuan)(?: nha| a| ban| shop)?$/.test(folded)) {
        return 'acknowledgement';
    }
    if (LOW_SIGNAL_FRUSTRATION.has(folded)) return 'frustration';
    if (LOW_SIGNAL_CONFUSION.has(folded)) return 'confusion';
    if (
        /\b(?:dat|mac|gia (?:hoi )?cao|phi (?:hoi )?cao|cao qua|khong hop ly|khong dang|ben khac re|ben kia re|shop khac re|de suy nghi|de minh suy nghi|de xem|de sau|chua can|chua mua|khong can|khong muon|khong mua|chua tin|khong tin|so|ngai|lo|bao hanh ngan|doi tra kho)\b/.test(folded)
    ) {
        return 'objection';
    }
    if (
        /\b(?:gia|bao nhieu|con hang|con mau|het hang|size|kich thuoc|mau nao|san pham|goi nao|dich vu|mua|dat hang|phi|khuyen mai|bao hanh|ship|giao hang|doi tra|thanh toan)\b/.test(folded)
    ) {
        return 'product_inquiry';
    }
    if (isLowSignalMessage(value)) return 'low_signal';
    return 'general';
}

export function isVagueFeatureQuery(value: string): boolean {
    const folded = foldConversationText(value);
    return /\b(?:chuc nang|tinh nang|phan mem|he thong|dich vu|tool|cong cu)\b/.test(folded);
}

/**
 * Give the model a turn-specific sales/support goal without inventing business
 * facts. Keeping this separate makes product and objection behavior testable.
 */
export function buildCurrentTurnGuidance(
    currentMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
): string {
    const intent = detectConversationTurnIntent(currentMessage);
    const hasHistory = conversationHistory.length > 0;

    if (intent === 'identity_question') {
        return detectIdentityQuestionKind(currentMessage) === 'automation'
            ? 'Khách đang hỏi thẳng có phải AI/bot/tự động hay không. Hãy nói rõ đây là trợ lý tự động của doanh nghiệp; không được né tránh hoặc nhận mình là người thật. Có thể đề nghị chuyển sang nhân viên.'
            : 'Khách chỉ đang hỏi vai trò hoặc đang nói chuyện với ai. Hãy giới thiệu vai trò và thương hiệu ngắn gọn; không tự đưa thuật ngữ AI/bot, đồng thời không được nhận mình là người thật hay một nhân viên cụ thể.';
    }
    if (isVagueFeatureQuery(currentMessage)) {
        return 'Khách đang hỏi về một chức năng/tính năng chưa rõ tên trên trang web. Hãy hỏi nhẹ nhàng xem khách đang tìm chức năng hoặc dịch vụ nào cụ thể để shop hỗ trợ kiểm tra giúp khách ngay. Tuyệt đối KHÔNG suy đoán các phần mềm hay hệ thống không liên quan (như Windows Server, Microsoft...).';
    }
    if (intent === 'product_inquiry') {
        return 'Khách đang hỏi sản phẩm, dịch vụ, giá hoặc tình trạng hàng. Trả lời thẳng bằng dữ liệu được cung cấp; nếu thiếu đúng một thông tin để tra cứu thì hỏi thông tin đó. Không bịa tồn kho, giá hay khuyến mãi và không liệt kê cả danh mục.';
    }
    if (intent === 'objection') {
        return 'Khách đang nêu băn khoăn hoặc phản đối. Ghi nhận đúng điều khách lo, trả lời bằng dữ liệu có sẵn, không tranh luận và không tự hứa giảm giá. Kết bằng một bước tiếp theo nhẹ nhàng, không gây áp lực mua.';
    }
    return hasHistory
        ? 'Tiếp nối đúng mạch hội thoại hiện tại; không chào lại và chỉ hỏi một câu cụ thể nếu còn thiếu thông tin.'
        : 'Mở đầu tự nhiên, ngắn gọn và đi thẳng vào nhu cầu khách vừa nêu.';
}

export function buildDirectIdentityReply(
    currentMessage: string,
    brandName?: string | null,
    personaConfig?: unknown,
): string | null {
    const identityKind = detectIdentityQuestionKind(currentMessage);
    if (!identityKind) return null;
    const persona = normalizeBotPersonaConfig(personaConfig);
    const safeBrand = String(brandName || '')
        .trim();
    const brandPhrase = safeBrand ? ` của ${safeBrand}` : '';
    const selfReference = persona.selfReference;
    const customerReference = persona.customerReference;

    if (identityKind === 'automation') {
        return `Dạ ${selfReference} là trợ lý tự động${brandPhrase} ạ. ${customerReference.charAt(0).toUpperCase() + customerReference.slice(1)} cần ${selfReference} tư vấn thông tin gì hay muốn nối máy tới nhân viên hỗ trợ trực tiếp nè?`;
    }

    return `Dạ ${selfReference} là trợ lý hỗ trợ khách hàng${brandPhrase} ạ. ${customerReference.charAt(0).toUpperCase() + customerReference.slice(1)} cần ${selfReference} xem giúp thông tin nào ạ?`;
}

function tokenSimilarity(left: string, right: string): number {
    const leftTokens = left.split(/\s+/).filter(Boolean);
    const rightTokens = right.split(/\s+/).filter(Boolean);
    if (!leftTokens.length || !rightTokens.length) return 0;
    const rightSet = new Set(rightTokens);
    let intersection = 0;
    leftTokens.forEach((token) => {
        if (rightSet.has(token)) intersection++;
    });
    return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

type ClarificationKind = 'product_identifier' | 'more_detail' | null;

function clarificationKind(value: string): ClarificationKind {
    const folded = foldConversationText(value);
    if (/\b(?:ten|ma|anh)\s+(?:san pham|dich vu|goi)\b/.test(folded)) {
        return 'product_identifier';
    }
    if (/\b(?:noi them|chi tiet them|noi dung can kiem tra|can tu van gi|thong tin can ho tro)\b/.test(folded)) {
        return 'more_detail';
    }
    return null;
}

/** True when a reply explicitly promises or requests a human follow-up. */
export function requestsHumanHandoff(value: string): boolean {
    const folded = foldConversationText(value);
    const staff = '(?:nhan vien|chuyen vien|nguoi phu trach)';
    return new RegExp(`\\b${staff}\\b.{0,24}\\b(?:se|kiem tra|phan hoi|bao lai|tiep nhan)\\b`).test(folded)
        || new RegExp(`\\b(?:bao|chuyen|de)\\b.{0,24}\\b${staff}\\b`).test(folded);
}

function isEmptyConversationalFiller(value: string): boolean {
    const folded = foldConversationText(value);
    return /^(?:rat tiec|tiec qua|hieu roi|minh hieu roi|cam on ban da chia se|dieu nay se giup|minh ghi nhan)(?:\b|[,.!])/i.test(folded);
}

function isCustomerQuestionOrRequest(value: string): boolean {
    const folded = foldConversationText(value);
    return /[?？]\s*$/.test(value)
        || /\b(?:cho|minh|shop)\s+(?:minh|shop)?\s*(?:biet|xin)\b/.test(folded)
        || /\b(?:gui|cung cap|chup)\s+(?:minh|shop)\b/.test(folded)
        || /\b(?:duoc khong|khong nhi|chua nhi|nhe)\s*[.!…]?$/.test(folded);
}

/**
 * Keep generated chat useful even when a provider ignores brevity instructions.
 * One turn may contain one concrete statement and one question at most.
 */
export function polishAutoReplyOutput(input: {
    candidate: string;
    history?: Array<{ role: string; content: string }>;
    maxSentences?: number;
}): string {
    const normalized = String(input.candidate || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!normalized) return '';

    const historicalAssistantUnits = (input.history || [])
        .filter(item => item.role === 'assistant')
        .flatMap(item => item.content.split(/\n+|(?<=[.!?…])\s+/u))
        .map(item => foldConversationText(item))
        .filter(Boolean);
    const units = normalized
        .split(/\n+|(?<=[.!?…])\s+/u)
        .map(item => item.trim())
        .filter(Boolean)
        .filter(item => !isEmptyConversationalFiller(item))
        .filter((item, index, all) => {
            const folded = foldConversationText(item);
            return all.findIndex(other => {
                const otherFolded = foldConversationText(other);
                return folded === otherFolded || tokenSimilarity(folded, otherFolded) >= 0.78;
            }) === index;
        });
    if (!units.length) return normalized;

    const statements = units.filter(item => !isCustomerQuestionOrRequest(item));
    const questions = units.filter(isCustomerQuestionOrRequest);
    const freshQuestions = questions.filter(question => {
        const folded = foldConversationText(question);
        return !historicalAssistantUnits.some(previous => (
            folded === previous || tokenSimilarity(folded, previous) >= 0.58
        ));
    });

    const limit = Math.min(2, Math.max(1, input.maxSentences || 2));
    const selected: string[] = [];
    if (statements.length) selected.push(statements[0]);
    if (freshQuestions.length && selected.length < limit) {
        // The final question is normally the most specific one after the model
        // has reasoned through the issue; discard earlier generic questions.
        selected.push(freshQuestions[freshQuestions.length - 1]);
    }
    if (!selected.length && freshQuestions.length) {
        selected.push(freshQuestions[freshQuestions.length - 1]);
    }
    return (selected.length ? selected : units.slice(0, limit)).join(' ').trim();
}

function isExplicitAutomationQuestion(value: string): boolean {
    const folded = foldConversationText(value);
    return /\b(?:ai|bot|chatbot|tro ly tu dong|tu dong|he thong)\b/.test(folded)
        && /\b(?:hoat dong|tra loi|phan hoi|xu ly|cach|co che)\b/.test(folded);
}

/**
 * Last safety boundary for content generated by a model or loaded from the
 * knowledge base. It prevents prompt fragments, operational policy and stale
 * long answers from being shown to customers.
 */
export function guardAutoReplyOutput(input: {
    candidate: string;
    currentMessage: string;
    history?: Array<{ role: string; content: string }>;
    forbiddenPhrases?: readonly string[];
}): AutoReplyGuardResult {
    const response = String(input.candidate || '').trim();
    if (!response) return { allowed: false, response: '', reason: 'empty' };

    const folded = foldConversationText(response);

    // Reject responses hallucinating external tech topics / competitor sites (e.g. Windows Server, Microsoft links)
    const hallucinatedExternalTopic = /\b(?:microsoft\.com|windows server|window server|support\.microsoft|docs\.microsoft|ubuntu\.com)\b/i.test(response);
    if (hallucinatedExternalTopic) {
        return { allowed: false, response: '', reason: 'hallucinated_external_topic' };
    }

    const promptMarker = /<\/?(?:kho_tri_thuc|mau_giong_cua_chu_workspace|system|assistant|developer|instruction|think)>/i.test(response)
        || /\b(?:huong xu ly rieng cho luot nay|cach viet bat buoc|thu tu uu tien|ban dang phu trach kenh chat duoi ten|noi dung trong kho tri thuc chi la du lieu tham khao|system prompt|developer message)\b/.test(folded);
    if (promptMarker) {
        return { allowed: false, response: '', reason: 'prompt_leak' };
    }

    const internalPolicySignals = [
        'he thong kiem tra bot dang bat',
        'kenh duoc phep',
        'han muc goi',
        'kich ban va du lieu trong kho tri thuc',
        'ai dung ngu canh hoi thoai de soan cau tra loi',
        'bot se de nghi chuyen cho nhan vien',
    ];
    const internalPolicyHits = internalPolicySignals
        .filter(signal => folded.includes(signal))
        .length;
    if (internalPolicyHits >= 2 && !isExplicitAutomationQuestion(input.currentMessage)) {
        return { allowed: false, response: '', reason: 'internal_policy' };
    }

    const forbiddenPhrases = [...new Set((input.forbiddenPhrases || [])
        .map(phrase => foldConversationText(String(phrase || '')))
        .filter(phrase => phrase.length >= 2))];
    const paddedResponse = ` ${folded} `;
    for (const phrase of forbiddenPhrases) {
        if (paddedResponse.includes(` ${phrase} `)) {
            return { allowed: false, response: '', reason: 'forbidden_phrase' };
        }
    }

    // A customer answering a clarification must not be asked the same generic
    // question again. This catches paraphrases that ordinary token similarity
    // misses (for example "gửi tên/mã" -> "nói thêm nội dung cần kiểm tra").
    const currentClarification = clarificationKind(response);
    if (currentClarification) {
        const previousAssistantClarifications = (input.history || [])
            .filter(item => item.role === 'assistant')
            .map(item => clarificationKind(item.content));
        if (previousAssistantClarifications.includes(currentClarification)) {
            return { allowed: false, response: '', reason: 'repeated_clarification' };
        }
    }

    if (folded.length >= 40) {
        const recentAssistantReplies = (input.history || [])
            .filter(item => item.role === 'assistant' && item.content.trim())
            .slice(-3);
        for (const item of recentAssistantReplies) {
            const previous = foldConversationText(item.content);
            if (!previous) continue;
            if (folded === previous || tokenSimilarity(folded, previous) >= 0.9) {
                return { allowed: false, response: '', reason: 'duplicate' };
            }
        }
    }

    return { allowed: true, response };
}

/**
 * Safe conversational fallback when neither the model nor the knowledge base
 * has a verified answer. Ask one useful question and never invent an offer.
 */
export function buildSafeNoKnowledgeReply(
    currentMessage: string,
    personaConfig?: unknown,
    conversationHistory?: Array<{ role: string; content: string }>,
): string {
    const persona = normalizeBotPersonaConfig(personaConfig);
    const selfReference = persona.selfReference;
    const customerReference = persona.customerReference;
    const capitalizedSelf = selfReference.charAt(0).toUpperCase() + selfReference.slice(1);
    const capitalizedCustomer = customerReference.charAt(0).toUpperCase() + customerReference.slice(1);
    const folded = foldConversationText(currentMessage);
    const isMedia = isStickerOrMediaMessage(currentMessage);

    if (/\bproxy\b/.test(folded)) {
        return `${capitalizedCustomer} cần proxy ở quốc gia nào vậy? ${capitalizedSelf} ghi nhận để nhân viên kiểm tra đúng gói giúp ${customerReference}.`;
    }
    if (/\bvps\b/.test(folded)) {
        return `${capitalizedCustomer} định dùng VPS cho việc gì vậy? ${capitalizedSelf} ghi nhận để nhân viên tư vấn đúng cấu hình cho ${customerReference}.`;
    }

    const recentAssistantReplies = (conversationHistory || [])
        .filter(item => item.role === 'assistant' && item.content.trim())
        .map(item => foldConversationText(item.content));

    let options: string[] = [];

    if (isMedia) {
        options = [
            `Dạ ${selfReference} đã nhận được hình ảnh/thông tin từ ${customerReference} rồi nha. Nhân viên hỗ trợ sẽ kiểm tra và phản hồi ${customerReference} ngay ạ!`,
            `Dạ ${capitalizedSelf} ghi nhận hình ảnh ${customerReference} gửi, chuyên viên sẽ kiểm tra và hỗ trợ ${customerReference} liền nha!`,
            `Dạ ${selfReference} đã xem qua ảnh ${customerReference} gửi rồi ạ. Nhân viên kỹ thuật sẽ kiểm tra chi tiết và báo lại ${customerReference} ngay nha!`,
        ];
    } else if (detectConversationTurnIntent(currentMessage) === 'product_inquiry') {
        options = [
            `${capitalizedSelf} ghi nhận nhu cầu của ${customerReference} rồi nha. ${capitalizedSelf} báo nhân viên kiểm tra thông tin và hỗ trợ ${customerReference} ngay ạ!`,
            `Dạ ${customerReference} chờ ${selfReference} chút nha, nhân viên hỗ trợ sẽ kiểm tra chi tiết thông tin dịch vụ và phản hồi ${customerReference} ngay ạ!`,
            `Dạ ${capitalizedCustomer} nhắn giúp ${selfReference} thêm chi tiết cần tư vấn nhé, ${selfReference} chuyển nhân viên hỗ trợ ${customerReference} liền ạ!`,
        ];
    } else {
        options = [
            `Dạ ${selfReference} ghi nhận thông tin rồi nha, nhân viên phụ trách sẽ kiểm tra và hỗ trợ ${customerReference} ngay ạ!`,
            `Dạ ${customerReference} đợi nhân viên bên ${selfReference} kiểm tra và hỗ trợ ${customerReference} trong giây lát nha!`,
            `Dạ ${capitalizedCustomer} nhắn chi tiết thêm giúp ${selfReference} nhé, nhân viên sẽ trực tiếp hỗ trợ ${customerReference} ngay ạ!`,
        ];
    }

    const unusedOption = options.find(opt => {
        const foldedOpt = foldConversationText(opt);
        return !recentAssistantReplies.some(prev => prev.includes(foldedOpt) || foldedOpt.includes(prev));
    });

    return unusedOption || options[0];
}

/** Include older intent in RAG only when the current turn is too terse to stand alone. */
export function buildKnowledgeSearchQuery(
    currentMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
): string {
    const intent = detectConversationTurnIntent(currentMessage);
    if (intent === 'product_inquiry' || intent === 'general') {
        const fullContext = conversationHistory
            .filter(item => item.role === 'user')
            .map(item => item.content)
            .join(' ');
        return `${fullContext} ${currentMessage}`.trim();
    }
    return currentMessage;
}

/**
 * Very short customer turns are better handled as conversation cues than sent
 * to a language model. This keeps replies fast, brief and avoids generic
 * assistant phrases such as "Hãy cho tôi biết thêm thông tin".
 */
export function buildNaturalLowSignalReply(
    currentMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    personaConfig?: unknown,
): string {
    const persona = normalizeBotPersonaConfig(personaConfig);
    const selfReference = persona.selfReference;
    const customerReference = persona.customerReference;
    const capitalizedSelf = selfReference.charAt(0).toUpperCase() + selfReference.slice(1);
    const capitalizedCustomer = customerReference.charAt(0).toUpperCase() + customerReference.slice(1);
    const intent = detectConversationTurnIntent(currentMessage);
    const lastAssistant = [...conversationHistory]
        .reverse()
        .find(item => item.role === 'assistant' && item.content.trim());
    const hasMeaningfulCustomerTurn = conversationHistory.some(item => (
        item.role === 'user' && isMeaningfulCustomerTurn(item.content)
    ));
    const assistantAskedQuestion = Boolean(lastAssistant && /[?？]\s*$/.test(lastAssistant.content));

    if (intent === 'thanks') {
        return `Không có gì nha, khi nào cần ${customerReference} cứ nhắn ${selfReference}.`;
    }
    if (intent === 'objection') {
        return `Dạ không sao nha ${customerReference}, khi nào cần hỗ trợ hoặc tư vấn thêm ${customerReference} cứ nhắn ${selfReference} nhé!`;
    }
    if (intent === 'frustration') {
        return `Có gì chưa ổn hả ${customerReference}? ${capitalizedCustomer} nói ${selfReference} nghe nhé.`;
    }
    if (intent === 'confusion' && lastAssistant) {
        return `${capitalizedSelf} nói chưa rõ chỗ nào hả ${customerReference}? ${capitalizedSelf} giải thích lại nhé.`;
    }
    if (intent === 'greeting') {
        if (!conversationHistory.length) return `Chào ${customerReference}, ${selfReference} nghe đây. ${capitalizedCustomer} cần ${selfReference} xem giúp gì nè?`;
        if (assistantAskedQuestion && hasMeaningfulCustomerTurn) {
            return `${capitalizedSelf} đây, khi tiện ${customerReference} gửi ${selfReference} thông tin đó nhé.`;
        }
        return `${capitalizedSelf} đây, ${customerReference} muốn ${selfReference} xem tiếp phần nào?`;
    }
    if (intent === 'acknowledgement' && hasMeaningfulCustomerTurn) {
        return assistantAskedQuestion
            ? `Oke ${customerReference}, khi tiện gửi ${selfReference} thông tin đó nhé.`
            : `Oke ${customerReference} nha.`;
    }
    if (hasMeaningfulCustomerTurn) {
        return `${capitalizedSelf} vẫn đang theo dõi đây, ${customerReference} nói thêm chỗ đang vướng nhé.`;
    }
    if (lastAssistant && /\bmình (?:nghe|đây)\b/i.test(lastAssistant.content)) {
        return `${capitalizedCustomer} cứ nhắn nội dung đang cần nhé, ${selfReference} xem cùng ${customerReference}.`;
    }
    return `${capitalizedSelf} nghe đây, ${customerReference} cứ nói nha.`;
}

export function isZaloGroupConversation(conversation: {
    channel?: unknown;
    metadata?: unknown;
}): boolean {
    if (String(conversation.channel || '').toLowerCase() !== 'zalo') return false;
    const metadata = objectValue(conversation.metadata);
    return metadata.threadType === 'group'
        || metadata.zaloThreadType === 'group'
        || metadata.isGroup === true;
}

export function isBotChannelEnabled(channelsValue: unknown, channel: string): boolean {
    const channels = objectValue(channelsValue);
    if (channel === 'messenger' || channel === 'facebook') {
        const messenger = objectValue(channels.messenger);
        const facebook = objectValue(channels.facebook);
        return messenger.enabled === true || facebook.enabled === true;
    }
    return objectValue(channels[channel]).enabled === true;
}
