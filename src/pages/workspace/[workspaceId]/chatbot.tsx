import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../../components/layout/AppLayout';
import {
    chatbotService,
    IAIBotData,
    IAIPersonaConfig,
    IAIReplyPreview,
    IAIRuntimeSettings,
} from '../../../services/chatbot.service';
import { 
    Button, Input, Select, Switch, Tag, Modal, message, Spin,
    Avatar, Form, InputNumber, Space
} from 'antd';
import {
    Bot, Plus, Pencil, Trash2, Power, PowerOff, MessageSquare, Users, 
    Globe, Send, Sparkles, Brain, Settings2, Play,
    Zap, BookOpen, Target, X
} from 'lucide-react';

const { TextArea } = Input;

// ────────── TYPES ──────────
interface BotItem {
    id: string;
    _id?: string; // backward compat
    name: string;
    avatarUrl?: string;
    brandName: string;
    brandDescription?: string;
    mainTask: string;
    conversationStyle: string;
    messageLength?: string;
    customGreeting?: string;
    welcomeMessage?: string;
    agentCondition?: IAIBotData['agentCondition'];
    followUp?: IAIBotData['followUp'];
    personaConfig?: IAIPersonaConfig;
    aiModel?: string;
    isActive: boolean;
    isDraft: boolean;
    stats: { totalConversations: number; totalReplies: number; leadsCollected: number };
    createdAt: string;
    channels: any;
    scenarios: any[];
    quickReplies: any[];
}

type AIQuota = {
    allowed: boolean;
    planId: string;
    used: number;
    limit: number | null;
    remaining: number | null;
    periodEnd: string;
    reason?: string;
};

const TASK_LABELS: Record<string, string> = {
    customer_care: 'Chăm sóc khách hàng',
    sales: 'Tư vấn bán hàng',
    technical_support: 'Hỗ trợ kỹ thuật',
};

const STYLE_LABELS: Record<string, string> = {
    friendly: 'Thân thiện',
    professional: 'Chuyên nghiệp',
    casual: 'Tự nhiên',
};

const LENGTH_LABELS: Record<string, string> = {
    short: 'Ngắn gọn',
    medium: 'Trung bình',
    long: 'Chi tiết',
};

const CHANNEL_META: Record<string, { label: string; icon: any; color: string }> = {
    website: { label: 'Website', icon: Globe, color: '#6366f1' },
    messenger: { label: 'Messenger', icon: MessageSquare, color: '#0084ff' },
    facebook: { label: 'Facebook Fanpage', icon: MessageSquare, color: '#1877F2' },
    zalo: { label: 'Zalo cá nhân', icon: Send, color: '#0068ff' },
    instagram: { label: 'Instagram', icon: Target, color: '#e4405f' },
};

const NEMARK_AI_GATEWAY = 'https://api.nemarkchat.com/v1';
const LOCAL_AI_GATEWAY = 'https://ai.nemarkchat.com/v1';
const DEFAULT_SMART_MODEL = 'qwen2.5:14b';
const AI_RUNTIME_PRESETS = [
    {
        key: 'nemark-local-14b',
        label: 'Khuyên dùng: Nemark Local AI 14B',
        description: 'Khách dùng gateway ổn định trên VPS, backend ưu tiên máy AI local 14B khi online.',
        values: {
            provider: 'openai-compatible' as IAIRuntimeSettings['provider'],
            baseUrl: NEMARK_AI_GATEWAY,
            model: DEFAULT_SMART_MODEL,
            temperature: 0.55,
            maxTokens: 700,
            timeoutMs: 60000,
        },
    },
    {
        key: 'direct-local-14b',
        label: 'VIP/private: gọi thẳng ai.nemarkchat.com 14B',
        description: 'Dành cho demo nội bộ hoặc khách VIP có key riêng vào gateway AI local.',
        values: {
            provider: 'openai-compatible' as IAIRuntimeSettings['provider'],
            baseUrl: LOCAL_AI_GATEWAY,
            model: DEFAULT_SMART_MODEL,
            temperature: 0.55,
            maxTokens: 700,
            timeoutMs: 90000,
        },
    },
    {
        key: 'deepseek-reasoning-14b',
        label: 'Suy luận mạnh: DeepSeek R1 14B',
        description: 'Dùng cho tư vấn kỹ thuật/kịch bản phức tạp, chậm hơn nhưng suy luận sâu hơn.',
        values: {
            provider: 'openai-compatible' as IAIRuntimeSettings['provider'],
            baseUrl: NEMARK_AI_GATEWAY,
            model: 'deepseek-r1:14b',
            temperature: 0.45,
            maxTokens: 900,
            timeoutMs: 90000,
        },
    },
    {
        key: 'cloud-fallback-fast',
        label: 'Fallback cloud nhanh',
        description: 'Dùng tạm khi máy AI local tắt; cần gateway cloud/API key phù hợp.',
        values: {
            provider: 'openai-compatible' as IAIRuntimeSettings['provider'],
            baseUrl: NEMARK_AI_GATEWAY,
            model: 'oc/minimax-m2.5-free',
            temperature: 0.7,
            maxTokens: 500,
            timeoutMs: 30000,
        },
    },
];

const AI_MODEL_OPTIONS = [
    { value: 'qwen2.5:14b', label: 'qwen2.5:14b — CSKH/bán hàng tiếng Việt khuyên dùng' },
    { value: 'deepseek-r1:14b', label: 'deepseek-r1:14b — suy luận sâu, chậm hơn' },
    { value: 'qwen2.5:7b', label: 'qwen2.5:7b — nhẹ/nhanh, chất lượng thấp hơn' },
    { value: 'oc/minimax-m2.5-free', label: 'oc/minimax-m2.5-free — fallback cloud' },
    { value: 'nemark-chat-v3', label: 'nemark-chat-v3 — alias cũ' },
];

const DEFAULT_PERSONA_CONFIG: IAIPersonaConfig = {
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

const PREVIEW_SOURCE_LABELS: Record<string, string> = {
    scenario: 'Kịch bản',
    ai: 'AI + tri thức',
    knowledge: 'Kho tri thức',
    greeting: 'Lời chào',
    identity: 'Danh tính',
    fallback: 'Hỏi thêm thông tin',
};

// ────────── DEFAULT BOT DATA ──────────
const defaultBotData: Partial<IAIBotData> = {
    name: 'Chatbot AI',
    brandName: '',
    brandDescription: '',
    mainTask: 'customer_care',
    conversationStyle: 'friendly',
    messageLength: 'medium',
    customGreeting: 'Chào mừng bạn ghé thăm website của chúng tôi 👋',
    welcomeMessage: '',
    channels: {
        website: { enabled: true },
        messenger: { enabled: true },
        facebook: { enabled: true },
        zalo: { enabled: true },
        instagram: { enabled: false },
    },
    agentCondition: 'no_condition',
    scenarios: [],
    quickReplies: [
        { label: 'Báo giá 💰', value: 'Tôi muốn xem báo giá' },
        { label: 'Hỗ trợ tôi ❓', value: 'Tôi cần hỗ trợ' },
    ],
    followUp: { enabled: false, delaySeconds: 30, message: 'Bạn còn cần hỗ trợ gì thêm không ạ?' },
    personaConfig: { ...DEFAULT_PERSONA_CONFIG },
    isActive: false,
    isDraft: true,
};

// ────────── MAIN PAGE ──────────
export default function ChatbotPage() {
    const router = useRouter();
    const { workspaceId } = router.query;
    const wsId = workspaceId as string;

    const [bots, setBots] = useState<BotItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBot, setEditingBot] = useState<BotItem | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<Partial<IAIBotData>>({ ...defaultBotData });
    const [saving, setSaving] = useState(false);
    const [aiForm] = Form.useForm<IAIRuntimeSettings>();
    const [aiRuntime, setAiRuntime] = useState<IAIRuntimeSettings | null>(null);
    const [aiLoading, setAiLoading] = useState(true);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiTesting, setAiTesting] = useState(false);
    const [aiQuota, setAiQuota] = useState<AIQuota | null>(null);
    const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; latencyMs: number; model: string; provider?: string; sample?: string } | null>(null);
    const [previewBotId, setPreviewBotId] = useState('');
    const [previewChannel, setPreviewChannel] = useState('website');
    const [previewContext, setPreviewContext] = useState('');
    const [previewMessage, setPreviewMessage] = useState('Mình cần thuê VPS cho website bán hàng, khoảng 20.000 lượt truy cập mỗi tháng.');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [replyPreview, setReplyPreview] = useState<IAIReplyPreview | null>(null);
    const selectedRuntimeModel = Form.useWatch('model', aiForm);
    const selectedRuntimeGateway = Form.useWatch('baseUrl', aiForm);

    // ── Fetch bots ──
    const fetchBots = useCallback(async () => {
        if (!wsId) return;
        setLoading(true);
        try {
            const res = await chatbotService.list(wsId);
            setBots(res.data || []);
        } catch {
            message.error('Không thể tải danh sách bot');
        } finally {
            setLoading(false);
        }
    }, [wsId]);

    useEffect(() => { fetchBots(); }, [fetchBots]);

    useEffect(() => {
        if (!bots.length) {
            setPreviewBotId('');
            return;
        }
        if (!bots.some(bot => bot.id === previewBotId)) {
            setPreviewBotId((bots.find(bot => bot.isActive) || bots[0]).id);
        }
    }, [bots, previewBotId]);

    const fetchAIRuntime = useCallback(async () => {
        if (!wsId) return;
        setAiLoading(true);
        try {
            const [runtimeRes, quotaRes] = await Promise.all([
                chatbotService.getAIRuntime(wsId),
                chatbotService.getAIQuota(wsId).catch(() => null),
            ]);
            const runtime = runtimeRes.data as IAIRuntimeSettings;
            setAiRuntime(runtime);
            if (quotaRes?.data) setAiQuota(quotaRes.data as AIQuota);
            aiForm.setFieldsValue({
                ...runtime,
                baseUrl: runtime.baseUrl || NEMARK_AI_GATEWAY,
                model: runtime.model || DEFAULT_SMART_MODEL,
                provider: runtime.provider || 'openai-compatible',
            });
        } catch {
            message.error('Không thể tải cấu hình AI Cloud');
        } finally {
            setAiLoading(false);
        }
    }, [aiForm, wsId]);

    useEffect(() => { fetchAIRuntime(); }, [fetchAIRuntime]);

    const applyAIRuntimePreset = (presetKey: string) => {
        const preset = AI_RUNTIME_PRESETS.find(item => item.key === presetKey);
        if (!preset) return;
        aiForm.setFieldsValue({
            enabled: true,
            ...preset.values,
        });
        setAiTestResult(null);
        message.success(`Đã áp dụng preset ${preset.label}`);
    };

    const getAIRuntimePayload = () => {
        const values = aiForm.getFieldsValue();
        const rawModel = Array.isArray(values.model) ? values.model[values.model.length - 1] : values.model;
        return {
            ...values,
            provider: values.enabled === false ? 'disabled' as IAIRuntimeSettings['provider'] : 'openai-compatible' as IAIRuntimeSettings['provider'],
            baseUrl: values.baseUrl?.trim() || NEMARK_AI_GATEWAY,
            model: rawModel?.trim() || DEFAULT_SMART_MODEL,
            temperature: Number(values.temperature ?? 0.55),
            maxTokens: Number(values.maxTokens ?? 700),
            timeoutMs: Number(values.timeoutMs ?? 60000),
        };
    };

    const handleSaveAIRuntime = async () => {
        if (!wsId) return;
        setAiSaving(true);
        try {
            const values = getAIRuntimePayload();
            const res = await chatbotService.updateAIRuntime(wsId, values);
            const runtime = res.data as IAIRuntimeSettings;
            setAiRuntime(runtime);
            aiForm.setFieldsValue({ ...runtime, apiKey: '' });
            message.success('Đã lưu cấu hình Nemark AI Cloud');
        } catch {
            message.error('Không thể lưu cấu hình Nemark AI Cloud');
        } finally {
            setAiSaving(false);
        }
    };

    const handleTestAIRuntime = async () => {
        if (!wsId) return;
        setAiTesting(true);
        setAiTestResult(null);
        try {
            const values = getAIRuntimePayload();
            const res = await chatbotService.testAIRuntime(wsId, values);
            setAiTestResult(res.data);
            message.success(`Kết nối AI OK (${res.data?.latencyMs || 0}ms)`);
        } catch (error) {
            const requestError = error as {
                code?: string;
                response?: {
                    data?: {
                        message?: string;
                        error?: string | { message?: string };
                    };
                };
            };
            const responseError = requestError.response?.data?.error;
            const serverMessage = (typeof responseError === 'string' ? responseError : responseError?.message)
                || requestError.response?.data?.message;
            const isTimeout = requestError.code === 'ECONNABORTED';
            message.error(
                serverMessage
                || (isTimeout
                    ? 'AI phản hồi quá 120 giây. Kiểm tra máy AI local hoặc Cloudflare Tunnel.'
                    : 'Test AI thất bại. Kiểm tra gateway VPS, model hoặc API key.'),
            );
        } finally {
            setAiTesting(false);
        }
    };

    const handlePreviewReply = async () => {
        if (!wsId) return;
        const cleanMessage = previewMessage.trim();
        if (!previewBotId) {
            message.warning('Hãy tạo hoặc chọn một bot trước khi thử phản hồi.');
            return;
        }
        if (!cleanMessage) {
            message.warning('Nhập một tin nhắn giả định của khách hàng.');
            return;
        }

        setPreviewLoading(true);
        setReplyPreview(null);
        try {
            const res = await chatbotService.previewReply(wsId, {
                botId: previewBotId,
                channel: previewChannel,
                message: cleanMessage,
                context: previewContext.trim() || undefined,
            });
            const result = res.data as IAIReplyPreview | null;
            if (!result?.response) {
                message.warning('Bot chưa tạo được phản hồi. Kiểm tra runtime, quota, kênh và kho tri thức.');
                return;
            }
            setReplyPreview(result);
            const quotaRes = await chatbotService.getAIQuota(wsId).catch(() => null);
            if (quotaRes?.data) setAiQuota(quotaRes.data as AIQuota);
        } catch {
            message.error('Không thể tạo phản hồi thử. Kiểm tra bot, AI Gateway hoặc quota của workspace.');
        } finally {
            setPreviewLoading(false);
        }
    };

    // ── Handlers ──
    const handleCreate = () => {
        setEditingBot(null);
        setFormData({
            ...defaultBotData,
            personaConfig: { ...DEFAULT_PERSONA_CONFIG },
        });
        setCurrentStep(0);
        setIsCreating(true);
    };

    const handleEdit = (bot: BotItem) => {
        setEditingBot(bot);
        setFormData({
            ...defaultBotData,
            name: bot.name,
            avatarUrl: bot.avatarUrl,
            brandName: bot.brandName,
            brandDescription: bot.brandDescription || '',
            mainTask: bot.mainTask as any,
            conversationStyle: bot.conversationStyle as any,
            messageLength: (bot.messageLength || 'medium') as any,
            customGreeting: bot.customGreeting || defaultBotData.customGreeting,
            welcomeMessage: bot.welcomeMessage || '',
            channels: bot.channels,
            agentCondition: bot.agentCondition || 'no_condition',
            scenarios: bot.scenarios || [],
            quickReplies: bot.quickReplies || [],
            followUp: bot.followUp || defaultBotData.followUp,
            personaConfig: {
                ...DEFAULT_PERSONA_CONFIG,
                ...(bot.personaConfig || {}),
            },
            isActive: bot.isActive,
            isDraft: bot.isDraft,
            aiModel: bot.aiModel,
        });
        setCurrentStep(0);
        setIsCreating(true);
    };

    const handleSave = async () => {
        if (!wsId) return;
        setSaving(true);
        try {
            if (editingBot) {
                await chatbotService.update(wsId, editingBot.id, formData);
                message.success('Đã cập nhật bot');
            } else {
                await chatbotService.create(wsId, formData);
                message.success('Đã tạo bot mới');
            }
            setIsCreating(false);
            fetchBots();
        } catch {
            message.error('Lưu thất bại');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (botId: string) => {
        Modal.confirm({
            title: 'Xóa Bot',
            content: 'Bạn có chắc chắn muốn xóa bot này?',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await chatbotService.remove(wsId, botId);
                    message.success('Đã xóa bot');
                    fetchBots();
                } catch {
                    message.error('Xóa thất bại');
                }
            },
        });
    };

    const handleToggle = async (botId: string, active: boolean) => {
        try {
            await chatbotService.toggleActive(wsId, botId, active);
            message.success(active ? 'Bot đã được bật' : 'Bot đã tắt');
            fetchBots();
        } catch {
            message.error('Thao tác thất bại');
        }
    };

    const updateForm = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const updatePersona = <K extends keyof IAIPersonaConfig>(key: K, value: IAIPersonaConfig[K]) => {
        setFormData(prev => ({
            ...prev,
            personaConfig: {
                ...DEFAULT_PERSONA_CONFIG,
                ...(prev.personaConfig || {}),
                [key]: value,
            },
        }));
    };

    const updatePersonaPatch = (patch: Partial<IAIPersonaConfig>) => {
        setFormData(prev => ({
            ...prev,
            personaConfig: {
                ...DEFAULT_PERSONA_CONFIG,
                ...(prev.personaConfig || {}),
                ...patch,
            },
        }));
    };

    const applyPersonaPreset = (preset: 'owner_voice' | 'warm_advisor' | 'brand_expert') => {
        const presets: Record<typeof preset, Partial<IAIPersonaConfig> & { conversationStyle: IAIBotData['conversationStyle'] }> = {
            owner_voice: {
                conversationStyle: 'casual',
                adaptToCustomerTone: true,
                toneInstructions: 'Nói chuyện tự nhiên như chính chủ shop: câu ngắn, gần gũi, có chính kiến nhưng không suồng sã quá mức.',
                emojiLevel: 'light',
                salesStyle: 'balanced',
                responsePace: 'natural',
                minDelayMs: 900,
                maxDelayMs: 3200,
                intelligenceLevel: 'balanced',
                replyGrouping: 'smart_burst',
                maxReplyParts: 3,
                interMessageDelayMs: 600,
            },
            warm_advisor: {
                conversationStyle: 'friendly',
                adaptToCustomerTone: true,
                toneInstructions: 'Ấm áp, tinh tế, lắng nghe nhu cầu rồi mới gợi ý; mỗi lượt chỉ hỏi một câu dễ trả lời.',
                emojiLevel: 'light',
                salesStyle: 'consultative',
                responsePace: 'natural',
                minDelayMs: 1100,
                maxDelayMs: 3600,
                intelligenceLevel: 'advanced',
                replyGrouping: 'smart_burst',
                maxReplyParts: 3,
                interMessageDelayMs: 750,
            },
            brand_expert: {
                conversationStyle: 'professional',
                adaptToCustomerTone: false,
                toneInstructions: 'Chắc chắn, rõ ràng, ưu tiên dữ liệu thương hiệu; giải thích ngắn và đưa ra một bước tiếp theo cụ thể.',
                emojiLevel: 'none',
                salesStyle: 'direct',
                responsePace: 'thoughtful',
                minDelayMs: 1600,
                maxDelayMs: 4800,
                intelligenceLevel: 'advanced',
                replyGrouping: 'smart_burst',
                maxReplyParts: 3,
                interMessageDelayMs: 850,
            },
        };
        const { conversationStyle, ...personaPatch } = presets[preset];
        setFormData(prev => ({
            ...prev,
            conversationStyle,
            personaConfig: {
                ...DEFAULT_PERSONA_CONFIG,
                ...(prev.personaConfig || {}),
                ...personaPatch,
            },
        }));
    };
    const personaConfig: IAIPersonaConfig = {
        ...DEFAULT_PERSONA_CONFIG,
        ...(formData.personaConfig || {}),
    };
    const personaSelf = personaConfig.selfReference || DEFAULT_PERSONA_CONFIG.selfReference;
    const personaCustomer = personaConfig.customerReference || DEFAULT_PERSONA_CONFIG.customerReference;
    const capitalizePersonaWord = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
    const personaSampleReplies = personaConfig.sampleReplies
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean);
    const personaPreviewReply = personaSampleReplies[0]
        || `${capitalizePersonaWord(personaSelf)} xem ngay cho ${personaCustomer} nha. ${capitalizePersonaWord(personaCustomer)} gửi ${personaSelf} mẫu hoặc gói đang quan tâm nhé.`;
    const personaPreviewParts = personaConfig.replyGrouping === 'smart_burst'
        ? (personaSampleReplies.length > 1
            ? personaSampleReplies.slice(0, personaConfig.maxReplyParts)
            : personaPreviewReply.split(/(?<=[.!?…])\s+/).filter(Boolean).slice(0, personaConfig.maxReplyParts))
        : [personaPreviewReply];

    // ── Steps definition ──
    const steps = [
        { key: 'design', label: 'Thiết kế', icon: Sparkles, desc: 'Thiết kế thương hiệu, cài đặt các nguồn dữ liệu cho chatbot AI,...' },
        { key: 'persona', label: 'Cá tính & nhịp chat', icon: MessageSquare, desc: 'Dạy cách xưng hô, giọng riêng, mẫu chat và tốc độ phản hồi' },
        { key: 'knowledge', label: 'Kiến thức', icon: Brain, desc: 'Cho phép trợ lý dùng dữ liệu đã xác nhận để trả lời khách' },
        { key: 'scenarios', label: 'Xử lý tình huống', icon: Settings2, desc: 'Hướng dẫn cách xử lý cho từng trường hợp cụ thể' },
        { key: 'conditions', label: 'Điều kiện chạy bot', icon: Play, desc: 'Chọn Website, Fanpage, Zalo và lúc trợ lý được phản hồi' },
    ];

    // ── If creating/editing: show builder ──
    if (isCreating) {
        return (
            <AppLayout hideHeader>
                <style>{`
                    .bot-builder { display: flex; min-width: 0; height: 100vh; background: #f8f9fc; }
                    .bot-builder-sidebar { width: 280px; background: #fff; border-right: 1px solid #e8e8ef; padding: 20px 0; flex-shrink: 0; display: flex; flex-direction: column; }
                    .bot-builder-header { padding: 0 20px 20px; border-bottom: 1px solid #e8e8ef; display: flex; align-items: center; gap: 12px; }
                    .bot-builder-header img, .bot-builder-header .bot-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #818cf8); display: flex; align-items: center; justify-content: center; color: #fff; }
                    .bot-builder-main { flex: 1; min-width: 0; overflow-y: auto; padding: 32px 40px; }
                    .step-item { padding: 14px 20px; cursor: pointer; display: flex; gap: 12px; align-items: flex-start; transition: all 0.2s; border-left: 3px solid transparent; }
                    .step-item:hover { background: #f3f4ff; }
                    .step-item.active { background: #eef2ff; border-left-color: #6366f1; }
                    .step-num { width: 28px; height: 28px; border-radius: 50%; background: #e8e8ef; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #64748b; flex-shrink: 0; }
                    .step-item.active .step-num { background: #6366f1; color: #fff; }
                    .step-label { font-weight: 600; font-size: 14px; color: #1e293b; }
                    .step-desc { font-size: 12px; color: #94a3b8; line-height: 1.4; margin-top: 2px; }
                    .form-section { background: #fff; border-radius: 8px; padding: 28px 32px; margin-bottom: 24px; border: 1px solid #e8e8ef; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
                    .form-section h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
                    .form-group { margin-bottom: 18px; }
                    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
                    .form-group label .required { color: #ef4444; margin-left: 2px; }
                    .form-group .hint { font-size: 12px; color: #94a3b8; margin-top: 4px; }
                    .channel-list { display: flex; flex-direction: column; gap: 12px; }
                    .channel-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
                    .channel-item .ch-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; }
                    .scenario-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; position: relative; }
                    .scenario-card .remove-btn { position: absolute; top: 8px; right: 8px; cursor: pointer; color: #94a3b8; }
                    .scenario-card .remove-btn:hover { color: #ef4444; }
                    .qr-tags { display: flex; flex-wrap: wrap; gap: 8px; }
                    .qr-tag { padding: 6px 14px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 20px; color: #4338ca; font-size: 13px; display: flex; align-items: center; gap: 6px; }
                    .persona-hero { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px; border: 1px solid #c7d2fe; border-radius: 16px; background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 55%, #ecfeff 100%); }
                    .persona-hero strong { display: block; color: #1e1b4b; font-size: 16px; }
                    .persona-hero span { display: block; max-width: 620px; margin-top: 4px; color: #64748b; font-size: 12px; line-height: 1.55; }
                    .persona-hero .persona-mode-control { display: flex; flex: 0 0 auto; align-items: center; gap: 10px; }
                    .persona-hero .persona-mode-label { display: block; max-width: none; margin: 0; color: #2563eb; font-size: 12px; font-weight: 700; line-height: 1; white-space: nowrap; }
                    .persona-hero .persona-mode-control.is-off .persona-mode-label { color: #64748b; }
                    .persona-mode-switch.ant-switch { min-width: 44px; flex: 0 0 44px; }
                    .persona-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
                    .persona-preset { padding: 14px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; cursor: pointer; text-align: left; transition: .2s ease; }
                    .persona-preset:hover { transform: translateY(-1px); border-color: #818cf8; box-shadow: 0 8px 22px rgba(99,102,241,.10); }
                    .persona-preset strong { display: block; color: #1e293b; font-size: 13px; }
                    .persona-preset span { display: block; margin-top: 4px; color: #64748b; font-size: 11.5px; line-height: 1.45; }
                    .persona-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
                    .persona-grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                    .persona-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
                    .persona-switch-row strong { display: block; color: #334155; font-size: 13px; }
                    .persona-switch-row span { display: block; margin-top: 2px; color: #94a3b8; font-size: 11px; line-height: 1.4; }
                    .persona-note { padding: 12px 14px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 12px; line-height: 1.55; }
                    .persona-timing-preview { display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
                    .persona-typing-dots { display: inline-flex; gap: 4px; padding: 8px 10px; border-radius: 14px; background: #fff; border: 1px solid #e2e8f0; }
                    .persona-typing-dots i { width: 6px; height: 6px; border-radius: 99px; background: #64748b; animation: personaDot 1.2s infinite ease-in-out; }
                    .persona-typing-dots i:nth-child(2) { animation-delay: .16s; }
                    .persona-typing-dots i:nth-child(3) { animation-delay: .32s; }
                    @keyframes personaDot { 0%, 60%, 100% { transform: translateY(0); opacity: .35; } 30% { transform: translateY(-3px); opacity: 1; } }
                    .preview-panel { width: 360px; background: #fff; border-left: 1px solid #e8e8ef; padding: 20px; flex-shrink: 0; display: flex; flex-direction: column; }
                    .preview-chat { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 12px; padding: 16px 0; }
                    .preview-bubble { max-width: 80%; padding: 10px 16px; border-radius: 16px; font-size: 14px; line-height: 1.5; animation: fadeInUp 0.3s ease; }
                    .preview-bubble.bot { background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; align-self: flex-start; }
                    .preview-bubble.user { background: #6366f1; color: #fff; border-bottom-right-radius: 4px; align-self: flex-end; }
                    .preview-qr { display: flex; flex-wrap: wrap; gap: 6px; }
                    .preview-qr-btn { padding: 6px 14px; border: 1.5px solid #6366f1; border-radius: 20px; color: #6366f1; font-size: 13px; background: #fff; cursor: pointer; }
                    .preview-input { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid #e8e8ef; }
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                    .agent-cond-list { display: flex; flex-direction: column; gap: 8px; }
                    .agent-cond-item { padding: 10px 16px; border: 1.5px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px; }
                    .agent-cond-item:hover { border-color: #a5b4fc; }
                    .agent-cond-item.selected { border-color: #6366f1; background: #eef2ff; }
                    .builder-actions { padding: 20px; border-top: 1px solid #e8e8ef; display: flex; gap: 12px; justify-content: flex-end; background: #fff; }
                    @media (max-width: 1250px) {
                        .bot-builder { height: auto; min-height: 100vh; flex-wrap: wrap; align-content: flex-start; }
                        .bot-builder-sidebar { width: 240px; min-height: 720px; }
                        .bot-builder-main { width: calc(100% - 240px); flex: 1 1 calc(100% - 240px); padding: 24px; }
                        .preview-panel { width: calc(100% - 240px); min-height: 520px; margin-left: 240px; border-top: 1px solid #e8e8ef; border-left: 0; }
                    }
                    @media (max-width: 720px) {
                        .bot-builder { display: block; }
                        .bot-builder-sidebar { width: 100%; min-height: 0; padding: 0; border-right: 0; border-bottom: 1px solid #e8e8ef; }
                        .bot-builder-header { padding: 12px 14px; }
                        .bot-builder-steps { display: flex; gap: 6px; overflow-x: auto; padding: 8px 10px !important; }
                        .step-item { flex: 0 0 auto; min-width: 120px; padding: 9px 10px; border: 1px solid #e2e8f0; border-radius: 8px; }
                        .step-item.active { border-color: #6366f1; }
                        .step-desc { display: none; }
                        .step-num { width: 24px; height: 24px; }
                        .builder-actions { padding: 10px 14px; }
                        .builder-actions .ant-btn { flex: 1; min-height: 40px; }
                        .bot-builder-main { width: 100%; padding: 14px 12px; overflow: visible; }
                        .form-section { padding: 16px 14px; margin-bottom: 14px; }
                        .persona-presets, .persona-grid, .persona-grid.three { grid-template-columns: 1fr; }
                        .persona-hero { align-items: flex-start; }
                        .scenario-fields { grid-template-columns: 1fr !important; }
                        .preview-panel { width: 100%; min-height: 500px; margin-left: 0; padding: 14px; }
                    }
                `}</style>

                <div className="bot-builder">
                    {/* ── LEFT: Steps sidebar ── */}
                    <div className="bot-builder-sidebar">
                        <div className="bot-builder-header">
                            <div className="bot-avatar"><Bot size={20} /></div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>{formData.name || 'Chatbot AI'}</div>
                                <Tag color={editingBot ? 'blue' : 'orange'} style={{ margin: 0 }}>
                                    {editingBot ? (editingBot.isActive ? 'Active' : 'Inactive') : 'Draft'}
                                </Tag>
                            </div>
                        </div>

                        <div className="bot-builder-steps" style={{ flex: 1, padding: '12px 0' }}>
                            {steps.map((step, idx) => (
                                <div
                                    key={step.key}
                                    className={`step-item ${currentStep === idx ? 'active' : ''}`}
                                    onClick={() => setCurrentStep(idx)}
                                >
                                    <div className="step-num">{idx + 1}</div>
                                    <div>
                                        <div className="step-label">{step.label}</div>
                                        <div className="step-desc">{step.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="builder-actions">
                            <Button onClick={() => setIsCreating(false)}>Hủy</Button>
                            <Button type="primary" loading={saving} onClick={handleSave}
                                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', borderRadius: 8 }}
                            >
                                Lưu
                            </Button>
                        </div>
                    </div>

                    {/* ── CENTER: Form content ── */}
                    <div className="bot-builder-main">
                        {/* Step 1: Design */}
                        {currentStep === 0 && (
                            <>
                                <div className="form-section">
                                    <h3><Sparkles size={18} color="#6366f1" /> Thương hiệu</h3>

                                    <div className="form-group">
                                        <label>Tên thương hiệu</label>
                                        <Input
                                            value={formData.brandName}
                                            onChange={e => updateForm('brandName', e.target.value)}
                                            placeholder="VD: NemarkChat"
                                            size="large"
                                            style={{ borderRadius: 10 }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Mô tả thương hiệu</label>
                                        <TextArea
                                            value={formData.brandDescription}
                                            onChange={e => updateForm('brandDescription', e.target.value)}
                                            placeholder="Giới thiệu ngắn về thương hiệu để AI hiểu ngữ cảnh..."
                                            rows={3}
                                            style={{ borderRadius: 10 }}
                                        />
                                        <div className="hint">AI sẽ dùng thông tin này để cá nhân hóa phản hồi</div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3><Bot size={18} color="#6366f1" /> Chân dung</h3>

                                    <div className="form-group">
                                        <label>Tên bot<span className="required">*</span></label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => updateForm('name', e.target.value)}
                                            placeholder="Chatbot AI"
                                            size="large"
                                            style={{ borderRadius: 10 }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Nhiệm vụ chính</label>
                                        <Select
                                            value={formData.mainTask}
                                            onChange={v => updateForm('mainTask', v)}
                                            style={{ width: '100%', borderRadius: 10 }}
                                            size="large"
                                            options={[
                                                { value: 'customer_care', label: 'Chăm sóc khách hàng' },
                                                { value: 'sales', label: 'Tư vấn bán hàng' },
                                                { value: 'technical_support', label: 'Hỗ trợ kỹ thuật' },
                                            ]}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Phong cách trò chuyện</label>
                                        <Select
                                            value={formData.conversationStyle}
                                            onChange={v => updateForm('conversationStyle', v)}
                                            style={{ width: '100%' }}
                                            size="large"
                                            options={[
                                                { value: 'friendly', label: '😊 Thân thiện' },
                                                { value: 'professional', label: '💼 Chuyên nghiệp' },
                                                { value: 'casual', label: '😎 Tự nhiên' },
                                            ]}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Độ dài thông điệp</label>
                                        <Select
                                            value={formData.messageLength}
                                            onChange={v => updateForm('messageLength', v)}
                                            style={{ width: '100%' }}
                                            size="large"
                                            options={[
                                                { value: 'short', label: 'Ngắn gọn' },
                                                { value: 'medium', label: 'Trung bình' },
                                                { value: 'long', label: 'Chi tiết' },
                                            ]}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Tin nhắn chào khách</label>
                                        <Input
                                            value={formData.customGreeting}
                                            onChange={e => updateForm('customGreeting', e.target.value)}
                                            placeholder="Chào mừng bạn ghé thăm website của chúng tôi 👋"
                                            size="large"
                                            style={{ borderRadius: 10 }}
                                        />
                                    </div>
                                </div>

                                {/* Quick Replies */}
                                <div className="form-section">
                                    <h3><Zap size={18} color="#f59e0b" /> Câu trả lời nhanh</h3>
                                    <div className="hint" style={{ marginBottom: 12 }}>Các nút nhanh hiển thị sau tin nhắn chào để khách lựa chọn</div>

                                    <div className="qr-tags">
                                        {(formData.quickReplies || []).map((qr, idx) => (
                                            <div key={idx} className="qr-tag">
                                                {qr.label}
                                                <X size={14} style={{ cursor: 'pointer' }} onClick={() => {
                                                    const newQR = [...(formData.quickReplies || [])];
                                                    newQR.splice(idx, 1);
                                                    updateForm('quickReplies', newQR);
                                                }} />
                                            </div>
                                        ))}
                                        <Button type="dashed" size="small" icon={<Plus size={14} />}
                                            onClick={() => {
                                                const label = prompt('Nhập label (VD: Báo giá 💰):');
                                                const value = prompt('Nhập nội dung gửi khi nhấn:');
                                                if (label && value) {
                                                    updateForm('quickReplies', [...(formData.quickReplies || []), { label, value }]);
                                                }
                                            }}
                                        >
                                            Thêm
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Step 2: Persona */}
                        {currentStep === 1 && (
                            <>
                                <div className="form-section">
                                    <h3><MessageSquare size={18} color="#6366f1" /> Chọn chất giọng khởi đầu</h3>
                                    <div className="persona-hero">
                                        <div>
                                            <strong>Trò chuyện tự nhiên theo giọng của bạn</strong>
                                            <span>
                                                Cấu hình này điều khiển cách xưng hô, nhịp câu và thời gian phản hồi.
                                                Trợ lý không tự giới thiệu là AI, nhưng luôn trả lời trung thực khi khách hỏi thẳng có phải AI/bot hay không.
                                            </span>
                                        </div>
                                        <div className={`persona-mode-control ${personaConfig.humanLikeMode ? 'is-on' : 'is-off'}`}>
                                            <span className="persona-mode-label">
                                                {personaConfig.humanLikeMode ? 'Đang bật' : 'Đã tắt'}
                                            </span>
                                            <Switch
                                                className="persona-mode-switch"
                                                aria-label="Bật chế độ trò chuyện tự nhiên"
                                                checked={personaConfig.humanLikeMode}
                                                onChange={checked => updatePersona('humanLikeMode', checked)}
                                            />
                                        </div>
                                    </div>

                                    <div className="persona-presets">
                                        <button
                                            type="button"
                                            className="persona-preset"
                                            onClick={() => applyPersonaPreset('owner_voice')}
                                        >
                                            <strong>✨ Giống tôi</strong>
                                            <span>Câu ngắn, tự nhiên như chính chủ shop đang tư vấn.</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="persona-preset"
                                            onClick={() => applyPersonaPreset('warm_advisor')}
                                        >
                                            <strong>🤝 Tư vấn ấm áp</strong>
                                            <span>Lắng nghe trước, hỏi vừa đủ và gợi ý nhẹ nhàng.</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="persona-preset"
                                            onClick={() => applyPersonaPreset('brand_expert')}
                                        >
                                            <strong>🎯 Chuyên gia thương hiệu</strong>
                                            <span>Chắc chắn, rõ dữ liệu và chủ động đề xuất bước tiếp theo.</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3><Sparkles size={18} color="#6366f1" /> Vai trò, xưng hô & giọng riêng</h3>

                                    <div className="form-group">
                                        <label>Vai trò khi giới thiệu</label>
                                        <Input
                                            value={personaConfig.roleTitle}
                                            onChange={event => updatePersona('roleTitle', event.target.value)}
                                            placeholder="VD: tư vấn viên của shop"
                                            maxLength={80}
                                            size="large"
                                            style={{ borderRadius: 10 }}
                                        />
                                        <div className="hint">Dùng khi khách hỏi “bạn là ai?”; không cần đưa thuật ngữ kỹ thuật vào câu trả lời.</div>
                                    </div>

                                    <div className="persona-grid">
                                        <div className="form-group">
                                            <label>Trợ lý tự xưng</label>
                                            <Input
                                                value={personaConfig.selfReference}
                                                onChange={event => updatePersona('selfReference', event.target.value)}
                                                placeholder="mình, em, tớ..."
                                                maxLength={24}
                                                size="large"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Gọi khách là</label>
                                            <Input
                                                value={personaConfig.customerReference}
                                                onChange={event => updatePersona('customerReference', event.target.value)}
                                                placeholder="bạn, anh/chị, cậu..."
                                                maxLength={24}
                                                size="large"
                                            />
                                        </div>
                                    </div>

                                    <div className="persona-switch-row" style={{ marginBottom: 18 }}>
                                        <div>
                                            <strong>Thích ứng với cách khách đang nhắn</strong>
                                            <span>Tự điều chỉnh độ trang trọng và nhịp câu, nhưng không bắt chước lời xúc phạm hoặc nội dung thiếu an toàn.</span>
                                        </div>
                                        <Switch
                                            checked={personaConfig.adaptToCustomerTone}
                                            onChange={checked => updatePersona('adaptToCustomerTone', checked)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Chỉ dẫn giọng nói riêng</label>
                                        <TextArea
                                            value={personaConfig.toneInstructions}
                                            onChange={event => updatePersona('toneInstructions', event.target.value)}
                                            placeholder="VD: Nói ngắn, có chính kiến, tránh văn tổng đài; nếu khách nhắn ngắn thì trả lời ngắn..."
                                            autoSize={{ minRows: 3, maxRows: 7 }}
                                            maxLength={1600}
                                            showCount
                                            style={{ borderRadius: 10 }}
                                        />
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Mẫu tin nhắn giống cách bạn nói</label>
                                        <TextArea
                                            value={personaConfig.sampleReplies}
                                            onChange={event => updatePersona('sampleReplies', event.target.value)}
                                            placeholder={'Dán 3–10 câu bạn từng trả lời khách, mỗi câu một dòng.\nVD: Oke bạn, gửi mình mã gói nhé, mình check đúng cấu hình cho.'}
                                            autoSize={{ minRows: 5, maxRows: 10 }}
                                            maxLength={5000}
                                            showCount
                                            style={{ borderRadius: 10 }}
                                        />
                                        <div className="hint">Hệ thống chỉ học nhịp câu và từ vựng; không lấy giá, chính sách hoặc cam kết trong mẫu làm dữ liệu thật.</div>
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3><Zap size={18} color="#f59e0b" /> Thói quen viết & bán hàng</h3>

                                    <div className="persona-grid">
                                        <div className="form-group">
                                            <label>Cụm từ quen thuộc</label>
                                            <TextArea
                                                value={personaConfig.signaturePhrases.join('\n')}
                                                onChange={event => updatePersona(
                                                    'signaturePhrases',
                                                    event.target.value
                                                        .split(/\r?\n|,/)
                                                        .map(value => value.trim())
                                                        .filter(Boolean)
                                                        .slice(0, 12),
                                                )}
                                                placeholder={'Oke bạn nha\nMình check ngay nhé'}
                                                autoSize={{ minRows: 3, maxRows: 6 }}
                                                maxLength={1500}
                                            />
                                            <div className="hint">Mỗi dòng một cụm; trợ lý chỉ dùng khi hợp ngữ cảnh, không lặp ở mọi tin.</div>
                                        </div>
                                        <div className="form-group">
                                            <label>Câu/cụm tuyệt đối không dùng</label>
                                            <TextArea
                                                value={personaConfig.forbiddenPhrases.join('\n')}
                                                onChange={event => updatePersona(
                                                    'forbiddenPhrases',
                                                    event.target.value
                                                        .split(/\r?\n|,/)
                                                        .map(value => value.trim())
                                                        .filter(Boolean)
                                                        .slice(0, 12),
                                                )}
                                                placeholder={'Có vẻ như bạn đang cần hỗ trợ\nHãy cho tôi biết thêm thông tin'}
                                                autoSize={{ minRows: 3, maxRows: 6 }}
                                                maxLength={1500}
                                            />
                                            <div className="hint">Mỗi dòng một câu máy móc hoặc từ ngữ không đúng thương hiệu.</div>
                                        </div>
                                    </div>

                                    <div className="persona-grid three">
                                        <div className="form-group">
                                            <label>Mức dùng emoji</label>
                                            <Select
                                                value={personaConfig.emojiLevel}
                                                onChange={value => updatePersona('emojiLevel', value)}
                                                style={{ width: '100%' }}
                                                size="large"
                                                options={[
                                                    { value: 'none', label: 'Không dùng' },
                                                    { value: 'light', label: 'Nhẹ — tối đa 1 emoji' },
                                                    { value: 'expressive', label: 'Biểu cảm — tối đa 2 emoji' },
                                                ]}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Cách tư vấn bán hàng</label>
                                            <Select
                                                value={personaConfig.salesStyle}
                                                onChange={value => updatePersona('salesStyle', value)}
                                                style={{ width: '100%' }}
                                                size="large"
                                                options={[
                                                    { value: 'consultative', label: 'Tư vấn theo nhu cầu' },
                                                    { value: 'balanced', label: 'Cân bằng giải đáp & CTA' },
                                                    { value: 'direct', label: 'Chủ động đề xuất' },
                                                ]}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Cách trả lời khi hỏi danh tính</label>
                                            <Select
                                                value={personaConfig.identityStyle}
                                                onChange={value => updatePersona('identityStyle', value)}
                                                style={{ width: '100%' }}
                                                size="large"
                                                options={[
                                                    { value: 'role_first', label: 'Nói vai trò trước' },
                                                    { value: 'transparent', label: 'Nói rõ trợ lý tự động' },
                                                ]}
                                            />
                                        </div>
                                    </div>

                                    <div className="persona-note">
                                        Chế độ “Nói vai trò trước” áp dụng cho câu hỏi chung như “bạn là ai?”.
                                        Nếu khách hỏi thẳng “có phải AI/bot không?”, hệ thống vẫn nói thật và có thể đề nghị chuyển nhân viên.
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3><Brain size={18} color="#6366f1" /> Độ thông minh & cách gửi tin</h3>

                                    <div className="persona-grid three">
                                        <div className="form-group">
                                            <label>Mức độ thông minh</label>
                                            <Select
                                                value={personaConfig.intelligenceLevel}
                                                onChange={(value: IAIPersonaConfig['intelligenceLevel']) => updatePersona('intelligenceLevel', value)}
                                                style={{ width: '100%' }}
                                                size="large"
                                                options={[
                                                    { value: 'quick', label: 'Nhanh — trả lời trực tiếp' },
                                                    { value: 'balanced', label: 'Cân bằng — hiểu ngữ cảnh' },
                                                    { value: 'advanced', label: 'Chuyên sâu — đối chiếu kỹ' },
                                                ]}
                                            />
                                            <div className="hint">
                                                {personaConfig.intelligenceLevel === 'advanced'
                                                    ? 'Đọc kỹ lịch sử và tri thức, suy luận sâu hơn; có thể chậm hơn.'
                                                    : personaConfig.intelligenceLevel === 'quick'
                                                        ? 'Ưu tiên tốc độ và câu trả lời ngắn từ dữ liệu rõ ràng.'
                                                        : 'Cân bằng tốc độ, độ chính xác và khả năng hiểu ý khách.'}
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Số tin tối đa mỗi lượt</label>
                                            <Select
                                                value={personaConfig.maxReplyParts}
                                                disabled={personaConfig.replyGrouping === 'single'}
                                                onChange={value => updatePersona('maxReplyParts', Number(value))}
                                                style={{ width: '100%' }}
                                                size="large"
                                                options={[2, 3, 4].map(value => ({ value, label: `${value} tin nhắn` }))}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Nghỉ giữa hai tin</label>
                                            <InputNumber
                                                value={personaConfig.interMessageDelayMs}
                                                disabled={personaConfig.replyGrouping === 'single'}
                                                onChange={value => updatePersona('interMessageDelayMs', Number(value || 250))}
                                                min={250}
                                                max={2500}
                                                step={50}
                                                addonAfter="ms"
                                                style={{ width: '100%' }}
                                                size="large"
                                            />
                                        </div>
                                    </div>

                                    <div className="persona-switch-row">
                                        <div>
                                            <strong>Chia câu trả lời thành nhiều tin ngắn</strong>
                                            <span>AI chỉ tạo nội dung một lần, hệ thống tự tách theo ý và gửi tuần tự. Không tốn thêm lượt AI.</span>
                                        </div>
                                        <Switch
                                            checked={personaConfig.replyGrouping === 'smart_burst'}
                                            onChange={checked => updatePersona('replyGrouping', checked ? 'smart_burst' : 'single')}
                                        />
                                    </div>

                                    {personaConfig.replyGrouping === 'smart_burst' && (
                                        <div className="persona-note" style={{ marginTop: 14 }}>
                                            Câu trả lời dài sẽ thành tối đa {personaConfig.maxReplyParts} bong bóng chat, cách nhau khoảng {(personaConfig.interMessageDelayMs / 1000).toFixed(2)} giây.
                                            URL, giá tiền và tên sản phẩm luôn được giữ nguyên trong cùng một tin.
                                        </div>
                                    )}
                                </div>

                                <div className="form-section">
                                    <h3><Play size={18} color="#6366f1" /> Nhịp phản hồi & trạng thái đang trả lời</h3>

                                    <div className="persona-grid three">
                                        <div className="form-group">
                                            <label>Tốc độ phản hồi</label>
                                            <Select
                                                value={personaConfig.responsePace}
                                                disabled={!personaConfig.humanLikeMode}
                                                onChange={(value: IAIPersonaConfig['responsePace']) => {
                                                    const delay = value === 'instant'
                                                        ? { minDelayMs: 250, maxDelayMs: 900 }
                                                        : value === 'thoughtful'
                                                            ? { minDelayMs: 1600, maxDelayMs: 4800 }
                                                            : { minDelayMs: 900, maxDelayMs: 3200 };
                                                    updatePersonaPatch({ responsePace: value, ...delay });
                                                }}
                                                style={{ width: '100%' }}
                                                size="large"
                                                options={[
                                                    { value: 'instant', label: 'Nhanh' },
                                                    { value: 'natural', label: 'Tự nhiên' },
                                                    { value: 'thoughtful', label: 'Cân nhắc kỹ' },
                                                ]}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Chờ tối thiểu</label>
                                            <InputNumber
                                                value={personaConfig.minDelayMs}
                                                disabled={!personaConfig.humanLikeMode}
                                                onChange={value => {
                                                    const minDelayMs = Number(value || 0);
                                                    updatePersonaPatch({
                                                        minDelayMs,
                                                        maxDelayMs: Math.max(minDelayMs, personaConfig.maxDelayMs),
                                                    });
                                                }}
                                                min={0}
                                                max={8000}
                                                step={100}
                                                addonAfter="ms"
                                                style={{ width: '100%' }}
                                                size="large"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Chờ tối đa</label>
                                            <InputNumber
                                                value={personaConfig.maxDelayMs}
                                                disabled={!personaConfig.humanLikeMode}
                                                onChange={value => updatePersona(
                                                    'maxDelayMs',
                                                    Math.max(personaConfig.minDelayMs, Number(value || 0)),
                                                )}
                                                min={personaConfig.minDelayMs}
                                                max={12000}
                                                step={100}
                                                addonAfter="ms"
                                                style={{ width: '100%' }}
                                                size="large"
                                            />
                                        </div>
                                    </div>

                                    <div className="persona-switch-row" style={{ marginBottom: 14 }}>
                                        <div>
                                            <strong>Hiện trạng thái đang trả lời</strong>
                                            <span>Khách thấy chấm chuyển động và nhãn bên dưới trong lúc hệ thống đang chuẩn bị phản hồi.</span>
                                        </div>
                                        <Switch
                                            checked={personaConfig.typingIndicator}
                                            disabled={!personaConfig.humanLikeMode}
                                            onChange={checked => updatePersona('typingIndicator', checked)}
                                        />
                                    </div>

                                    <div className="persona-grid">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>Nhãn hiển thị với khách</label>
                                            <Input
                                                value={personaConfig.typingLabel}
                                                disabled={!personaConfig.humanLikeMode || !personaConfig.typingIndicator}
                                                onChange={event => updatePersona('typingLabel', event.target.value)}
                                                placeholder="Đang trả lời…"
                                                maxLength={40}
                                                size="large"
                                            />
                                        </div>
                                        <div className="persona-timing-preview">
                                            {personaConfig.typingIndicator && personaConfig.humanLikeMode ? (
                                                <div className="persona-typing-dots" aria-hidden="true">
                                                    <i /><i /><i />
                                                </div>
                                            ) : (
                                                <Zap size={18} color="#94a3b8" />
                                            )}
                                            <div>
                                                <div style={{ color: '#334155', fontSize: 12, fontWeight: 800 }}>
                                                    {personaConfig.typingIndicator && personaConfig.humanLikeMode
                                                        ? personaConfig.typingLabel || 'Đang trả lời…'
                                                        : 'Gửi ngay khi có kết quả'}
                                                </div>
                                                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                                                    Khoảng {(personaConfig.minDelayMs / 1000).toFixed(1)}–{(personaConfig.maxDelayMs / 1000).toFixed(1)} giây, đã tính thời gian model xử lý.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Step 3: Knowledge */}
                        {currentStep === 2 && (
                            <div className="form-section">
                                <h3><Brain size={18} color="#6366f1" /> Kiến thức</h3>
                                <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7 }}>
                                    Cho phép trợ lý AI học từ dữ liệu bạn tải lên để trả lời câu hỏi của khách hàng.
                                    Bot sẽ sử dụng <strong>Knowledge Base</strong> có sẵn trong workspace.
                                </p>

                                <div style={{ 
                                    textAlign: 'center', padding: '40px 20px', 
                                    background: '#f8fafc', borderRadius: 16, 
                                    border: '2px dashed #d1d5db', marginTop: 20 
                                }}>
                                    <BookOpen size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                                    <div style={{ fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                                        Dữ liệu kiến thức được quản lý tại mục Knowledge
                                    </div>
                                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                                        Bot sẽ tự động sử dụng tất cả dữ liệu Knowledge Base của workspace để trả lời khách hàng
                                    </div>
                                    <Button
                                        type="primary"
                                        icon={<BookOpen size={16} />}
                                        style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', border: 'none', borderRadius: 8 }}
                                        onClick={() => window.open(`/workspace/${wsId}/settings`, '_blank')}
                                    >
                                        Quản lý Knowledge Base
                                    </Button>
                                </div>

                                <div style={{ marginTop: 20, padding: 16, background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
                                    <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Sparkles size={16} /> Gợi ý
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 20, color: '#3b82f6', fontSize: 13, lineHeight: 1.8 }}>
                                        <li>Tải lên file FAQ (Câu hỏi thường gặp) từ Google Sheets</li>
                                        <li>Thêm thông tin sản phẩm, bảng giá, chính sách</li>
                                        <li>Càng nhiều dữ liệu, bot trả lời càng chính xác</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Scenarios */}
                        {currentStep === 3 && (
                            <div className="form-section">
                                <h3><Settings2 size={18} color="#6366f1" /> Xử lý tình huống</h3>
                                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
                                    Hướng dẫn AI cách xử lý cho từng tình huống cụ thể. Khi khách nhắn chứa từ khóa, bot sẽ trả lời theo kịch bản đã thiết lập.
                                </p>

                                {(formData.scenarios || []).map((sc, idx) => (
                                    <div key={idx} className="scenario-card">
                                        <div className="remove-btn" onClick={() => {
                                            const newSc = [...(formData.scenarios || [])];
                                            newSc.splice(idx, 1);
                                            updateForm('scenarios', newSc);
                                        }}>
                                            <X size={16} />
                                        </div>
                                        <div className="scenario-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                            <div>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Khi khách nhắn chứa</label>
                                                <Input
                                                    value={sc.trigger}
                                                    onChange={e => {
                                                        const newSc = [...(formData.scenarios || [])];
                                                        newSc[idx] = { ...newSc[idx], trigger: e.target.value };
                                                        updateForm('scenarios', newSc);
                                                    }}
                                                    placeholder="VD: giá, báo giá, bao nhiêu"
                                                    style={{ borderRadius: 8 }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Kiểu khớp</label>
                                                <Select
                                                    value={sc.triggerType}
                                                    onChange={v => {
                                                        const newSc = [...(formData.scenarios || [])];
                                                        newSc[idx] = { ...newSc[idx], triggerType: v };
                                                        updateForm('scenarios', newSc);
                                                    }}
                                                    style={{ width: '100%' }}
                                                    options={[
                                                        { value: 'contains', label: 'Chứa từ khóa' },
                                                        { value: 'keyword', label: 'Từ khóa chính xác' },
                                                        { value: 'regex', label: 'Biểu thức chính quy' },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Bot sẽ trả lời</label>
                                            <TextArea
                                                value={sc.response}
                                                onChange={e => {
                                                    const newSc = [...(formData.scenarios || [])];
                                                    newSc[idx] = { ...newSc[idx], response: e.target.value };
                                                    updateForm('scenarios', newSc);
                                                }}
                                                placeholder="Nội dung bot trả lời..."
                                                rows={2}
                                                style={{ borderRadius: 8 }}
                                            />
                                        </div>
                                    </div>
                                ))}

                                <Button
                                    type="dashed"
                                    icon={<Plus size={16} />}
                                    onClick={() => {
                                        updateForm('scenarios', [
                                            ...(formData.scenarios || []),
                                            { trigger: '', triggerType: 'contains', response: '', priority: 0 },
                                        ]);
                                    }}
                                    style={{ width: '100%', height: 44, borderRadius: 10 }}
                                >
                                    Thêm kịch bản
                                </Button>
                            </div>
                        )}

                        {/* Step 5: Conditions */}
                        {currentStep === 4 && (
                            <>
                                <div className="form-section">
                                    <h3><Globe size={18} color="#6366f1" /> Kênh tương tác</h3>
                                    <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                                        Trả lời khách nhắn tin trên website, fanpage, zalo, ...
                                    </p>

                                    <div className="channel-list">
                                        {Object.entries(CHANNEL_META).map(([key, meta]) => {
                                            const Icon = meta.icon;
                                            const enabled = formData.channels?.[key as keyof typeof formData.channels]?.enabled || false;
                                            return (
                                                <div key={key} className="channel-item">
                                                    <Switch
                                                        checked={enabled}
                                                        onChange={checked => {
                                                            updateForm('channels', {
                                                                ...formData.channels,
                                                                [key]: { ...formData.channels?.[key as keyof typeof formData.channels], enabled: checked },
                                                            });
                                                        }}
                                                        size="small"
                                                    />
                                                    <div className="ch-icon" style={{ background: meta.color }}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{meta.label}</div>
                                                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                                            {enabled ? `Chạy với tất cả ${meta.label.toLowerCase()}` : 'Đã tắt'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="form-section">
                                    <h3><Users size={18} color="#6366f1" /> Tư vấn viên online/offline</h3>
                                    <div className="agent-cond-list">
                                        {[
                                            { value: 'no_condition', label: 'Không có điều kiện', desc: 'Bot luôn chạy bất kể agent online hay không' },
                                            { value: 'no_agent_online', label: 'Không có ai online', desc: 'Bot chỉ chạy khi không có agent nào online' },
                                            { value: 'at_least_one_online', label: 'Có ít nhất một người online', desc: 'Bot chạy khi có agent online để chuyển tiếp' },
                                            { value: 'always', label: 'Luôn luôn chạy', desc: 'Bot chạy song song cùng agent' },
                                        ].map(opt => (
                                            <div
                                                key={opt.value}
                                                className={`agent-cond-item ${formData.agentCondition === opt.value ? 'selected' : ''}`}
                                                onClick={() => updateForm('agentCondition', opt.value)}
                                            >
                                                <div style={{
                                                    width: 18, height: 18, borderRadius: '50%',
                                                    border: formData.agentCondition === opt.value ? '5px solid #6366f1' : '2px solid #cbd5e1',
                                                    flexShrink: 0,
                                                }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
                                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{opt.desc}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* ── RIGHT: Live Preview ── */}
                    <div className="preview-panel">
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Play size={16} color="#6366f1" /> Xem thử
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Preview bot chat</div>

                        <div style={{ flex: 1, background: '#f8fafc', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', border: '1px solid #e8e8ef' }}>
                            <div className="preview-chat">
                                {/* Bot name indicator */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Bot size={14} color="#fff" />
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>{formData.name || 'Chatbot AI'}</span>
                                </div>

                                {/* Greeting */}
                                <div className="preview-bubble bot">
                                    {formData.customGreeting || 'Chào mừng bạn ghé thăm website của chúng tôi 👋'}
                                </div>

                                {/* Quick Replies */}
                                {(formData.quickReplies || []).length > 0 && (
                                    <div className="preview-qr">
                                        {(formData.quickReplies || []).map((qr, i) => (
                                            <div key={i} className="preview-qr-btn">{qr.label}</div>
                                        ))}
                                    </div>
                                )}

                                {/* Sample user message */}
                                <div className="preview-bubble user">Tôi muốn xem báo giá</div>

                                {currentStep === 1 && (
                                    <>
                                        {personaConfig.humanLikeMode && personaConfig.typingIndicator && (
                                            <div className="persona-timing-preview" style={{ alignSelf: 'flex-start', padding: '8px 10px' }}>
                                                <div className="persona-typing-dots" aria-hidden="true">
                                                    <i /><i /><i />
                                                </div>
                                                <span style={{ color: '#64748b', fontSize: 11.5 }}>
                                                    {personaConfig.typingLabel || 'Đang trả lời…'}
                                                </span>
                                            </div>
                                        )}
                                        {personaPreviewParts.map((part, index) => (
                                            <div className="preview-bubble bot" key={`${part}-${index}`}>{part}</div>
                                        ))}
                                    </>
                                )}

                                {/* Bot response from scenario */}
                                {currentStep !== 1 && (formData.scenarios || []).length > 0 && formData.scenarios![0].response && (
                                    <div className="preview-bubble bot">{formData.scenarios![0].response}</div>
                                )}
                                {currentStep !== 1 && (formData.scenarios || []).length === 0 && (
                                    <div className="preview-bubble bot" style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                                        Bot sẽ tìm trong knowledge base và trả lời...
                                    </div>
                                )}
                            </div>

                            <div className="preview-input">
                                <Input placeholder="Type a message..." disabled style={{ borderRadius: 20, flex: 1 }} />
                                <Send size={18} color="#94a3b8" />
                            </div>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // ────────── BOT LIST VIEW ──────────
    return (
        <AppLayout headerTitle={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ 
                    width: 36, height: 36, borderRadius: 10, 
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                    <Bot size={20} color="#fff" />
                </div>
                <span>Nhân viên AI</span>
            </div>
        } headerExtra={
            <div className="chatbot-header-actions">
                <Button
                    className="widget-config-button"
                    icon={<Settings2 size={16} />}
                    onClick={() => router.push(`/workspace/${wsId}/widgets`)}
                    aria-label="Cấu hình Widget website"
                    style={{ borderRadius: 8, height: 38, fontWeight: 700 }}
                >
                    <span className="widget-config-button-label">Widget website</span>
                </Button>
                <Button
                    className="create-ai-button"
                    type="primary"
                    icon={<Plus size={16} />}
                    onClick={handleCreate}
                    aria-label="Tạo Bot AI"
                    style={{
                        background: '#2563eb',
                        border: 'none', borderRadius: 8, height: 38, fontWeight: 700,
                        boxShadow: '0 3px 10px rgba(37,99,235,0.18)',
                    }}
                >
                    Tạo Bot AI
                </Button>
            </div>
        }>
            <style>{`
                .chatbot-header-actions { display: flex; align-items: center; gap: 8px; }
                .chatbot-page { width: 100%; max-width: 1500px; margin: 0 auto; padding: 24px 32px; overflow-x: clip; display: flex; flex-direction: column; }
                .bot-hero {
                    background: linear-gradient(110deg, #ffffff 0%, #f4f8ff 72%, #edf4ff 100%);
                    border-radius: 8px; padding: 20px 24px; margin-bottom: 18px;
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 18px; border: 1px solid #d7e4f7;
                }
                .bot-hero-kicker { color: #2563eb; font-size: 11px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
                .bot-hero-title { margin: 0; color: #172033; font-size: 21px; font-weight: 850; letter-spacing: -.02em; }
                .bot-hero-copy { margin-top: 5px; color: #667085; font-size: 13px; line-height: 1.55; }
                .bot-hero-metrics { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
                .bot-hero-metric { min-width: 102px; padding: 9px 12px; border: 1px solid #dbe7f6; border-radius: 8px; background: rgba(255,255,255,.82); }
                .bot-hero-metric strong { display: block; color: #172033; font-size: 15px; line-height: 1.2; }
                .bot-hero-metric span { display: block; margin-top: 2px; color: #667085; font-size: 11px; font-weight: 650; }
                .bot-hero { order: 1; }
                .ai-ops-guide { order: 2; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
                .ai-ops-step { appearance: none; width: 100%; text-align: left; padding: 14px; border: 1px solid #dbe7f6; border-radius: 12px; background: #fff; color: inherit; cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
                .ai-ops-step:hover { transform: translateY(-2px); border-color: #93c5fd; box-shadow: 0 10px 24px rgba(37,99,235,.08); }
                .ai-ops-number { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 900; }
                .ai-ops-title { display: block; margin-top: 10px; color: #172033; font-size: 13px; font-weight: 850; }
                .ai-ops-copy { display: block; margin-top: 4px; color: #667085; font-size: 11px; line-height: 1.45; }
                .bot-overview { order: 3; margin-bottom: 22px; }
                .ai-reply-lab { order: 4; margin-bottom: 22px; border: 1px solid #dbe7f6; border-radius: 14px; background: linear-gradient(135deg, #fff 0%, #f8fbff 100%); overflow: hidden; box-shadow: 0 12px 32px rgba(37,99,235,.06); }
                .ai-reply-lab-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid #e7eef8; }
                .ai-reply-lab-head h2 { margin: 0; color: #101828; font-size: 17px; font-weight: 850; }
                .ai-reply-lab-head p { margin: 4px 0 0; color: #667085; font-size: 12px; line-height: 1.5; }
                .ai-reply-lab-safe { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 800; white-space: nowrap; }
                .ai-reply-lab-grid { display: grid; grid-template-columns: minmax(0, .92fr) minmax(360px, 1.08fr); }
                .ai-reply-lab-controls { padding: 18px 20px; border-right: 1px solid #e7eef8; }
                .ai-reply-lab-selects { display: grid; grid-template-columns: minmax(0, 1fr) 160px; gap: 10px; }
                .ai-reply-lab-label { display: block; margin: 0 0 6px; color: #344054; font-size: 11px; font-weight: 800; }
                .ai-reply-lab-field { margin-top: 12px; }
                .ai-reply-lab-hint { margin-top: 10px; color: #667085; font-size: 11px; line-height: 1.5; }
                .ai-reply-lab-preview { min-height: 340px; padding: 18px 20px; display: flex; flex-direction: column; background: radial-gradient(circle at 100% 0%, rgba(99,102,241,.1), transparent 42%), #f8fafc; }
                .ai-reply-lab-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; min-height: 24px; }
                .ai-reply-lab-pill { padding: 4px 8px; border-radius: 999px; background: #fff; border: 1px solid #dbe7f6; color: #475467; font-size: 10.5px; font-weight: 750; }
                .ai-reply-lab-chat { display: flex; flex: 1; flex-direction: column; justify-content: flex-end; gap: 10px; padding-top: 20px; }
                .ai-reply-bubble { max-width: 86%; padding: 11px 14px; border-radius: 16px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
                .ai-reply-bubble.customer { align-self: flex-end; color: #fff; background: linear-gradient(135deg, #2563eb, #4f46e5); border-bottom-right-radius: 5px; box-shadow: 0 8px 18px rgba(37,99,235,.18); }
                .ai-reply-bubble.bot { align-self: flex-start; color: #172033; background: #fff; border: 1px solid #e2e8f0; border-bottom-left-radius: 5px; box-shadow: 0 8px 20px rgba(15,23,42,.06); }
                .ai-reply-lab-empty { margin: auto; max-width: 330px; text-align: center; color: #667085; font-size: 12px; line-height: 1.55; }
                .ai-reply-lab-empty strong { display: block; margin-bottom: 4px; color: #344054; font-size: 13px; }
                .ai-settings-heading { order: 5; }
                .ai-runtime-grid { order: 6; }
                .bot-overview-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
                .bot-overview-head h2 { margin: 0; color: #101828; font-size: 17px; font-weight: 800; }
                .bot-overview-head p { margin: 3px 0 0; color: #667085; font-size: 12px; }
                .bot-active-summary { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 750; white-space: nowrap; }
                .bot-active-summary::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #12b76a; box-shadow: 0 0 0 3px rgba(18,183,106,.12); }
                .ai-settings-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 2px 0 12px; }
                .ai-settings-heading h2 { margin: 0; color: #101828; font-size: 17px; font-weight: 800; }
                .ai-settings-heading p { margin: 3px 0 0; color: #667085; font-size: 12px; }
                .ai-runtime-card { background: #fff; border: 1px solid #e8e8ef; border-radius: 8px; padding: 22px; box-shadow: 0 10px 30px rgba(15,23,42,0.04); min-width: 0; }
                .ai-runtime-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
                .ai-runtime-head > div { min-width: 0; }
                .ai-plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 14px; }
                .ai-quota-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 12px; }
                .ai-runtime-form-grid { display: grid; grid-template-columns: 180px minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
                .ai-runtime-tuning-grid { display: grid; grid-template-columns: minmax(220px, 1fr) repeat(3, 140px); gap: 12px; }
                .ai-runtime-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
                .ai-deploy-card { background: #0f172a; border-radius: 8px; padding: 20px; color: #e2e8f0; box-shadow: 0 18px 50px rgba(15,23,42,0.18); min-width: 0; }
                .bot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 420px)); gap: 14px; align-items: stretch; }
                .bot-card { 
                    background: #fff; border-radius: 8px; padding: 18px;
                    border: 1px solid #e8e8ef; transition: all 0.25s ease;
                    cursor: pointer; position: relative; overflow: hidden;
                }
                .bot-card:hover { 
                    transform: translateY(-2px); 
                    box-shadow: 0 8px 24px rgba(99,102,241,0.12);
                    border-color: #a5b4fc; 
                }
                .bot-card-header { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: start; gap: 12px; margin-bottom: 14px; }
                .bot-card-title { min-width: 0; }
                .bot-card-title-name { overflow: hidden; color: #1e293b; font-size: 16px; font-weight: 750; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
                .bot-card-meta { display: flex; align-items: center; gap: 6px; min-width: 0; margin-top: 5px; }
                .bot-card-task { min-width: 0; overflow: hidden; color: #7c8799; font-size: 12px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
                .bot-card-toggle { margin-top: 2px; align-self: start; }
                .bot-card-avatar { 
                    width: 48px; height: 48px; border-radius: 8px;
                    background: linear-gradient(135deg, #2563eb, #4f7cf7);
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 4px 12px rgba(37,99,235,0.2);
                }
                .bot-card-stats { 
                    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; 
                    padding: 12px 0; margin-top: 12px; border-top: 1px solid #f1f5f9;
                }
                .bot-stat { text-align: center; }
                .bot-stat-val { font-size: 18px; font-weight: 700; color: #1e293b; }
                .bot-stat-label { font-size: 11px; color: #94a3b8; margin-top: 2px; }
                .bot-card-channels { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
                .bot-card-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
                .empty-state { 
                    display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 16px;
                    padding: 22px; background: #fff; border-radius: 8px; border: 1px dashed #cbd5e1;
                }
                .empty-state-copy { min-width: 0; }
                .empty-state-copy strong { display: block; color: #344054; font-size: 15px; }
                .empty-state-copy span { display: block; margin-top: 3px; color: #667085; font-size: 12px; }
                @media (max-width: 1100px) {
                    .ai-ops-guide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .ai-reply-lab-grid { grid-template-columns: 1fr 1fr; }
                    .ai-runtime-grid { grid-template-columns: 1fr !important; }
                    .ai-deploy-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 0.7fr); gap: 16px; align-items: start; }
                    .ai-deploy-card > div { margin-top: 0 !important; }
                }
                @media (max-width: 780px) {
                    .chatbot-page { padding: 16px; }
                    .bot-hero { align-items: flex-start; padding: 18px; }
                    .bot-hero-metrics { max-width: 240px; }
                    .ai-runtime-card { padding: 18px; }
                    .ai-runtime-head { align-items: stretch; }
                    .ai-runtime-form-grid { grid-template-columns: 140px minmax(0, 1fr); }
                    .ai-runtime-form-grid .ant-form-item:last-child { grid-column: 1 / -1; }
                    .ai-runtime-tuning-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .ai-runtime-tuning-grid .ant-form-item:first-child { grid-column: 1 / -1; }
                    .ai-reply-lab-grid { grid-template-columns: 1fr; }
                    .ai-reply-lab-controls { border-right: 0; border-bottom: 1px solid #e7eef8; }
                    .ai-deploy-card { display: block; }
                    .ai-deploy-card > div { margin-top: 12px !important; }
                }
                @media (max-width: 680px) {
                    .create-ai-button > span:not(.ant-btn-icon) { display: none; }
                    .create-ai-button { width: 38px; padding-inline: 0 !important; }
                    .widget-config-button-label { display: none; }
                    .widget-config-button { width: 38px; padding-inline: 0 !important; }
                    .bot-hero { display: grid; }
                    .bot-hero-metrics { width: 100%; max-width: none; justify-content: stretch; }
                    .bot-hero-metric { flex: 1; min-width: 0; }
                    .bot-overview-head, .ai-settings-heading { align-items: flex-start; }
                }
                @media (max-width: 560px) {
                    .chatbot-page { padding: 12px; }
                    .bot-hero { padding: 16px; }
                    .bot-hero br { display: none; }
                    .ai-ops-guide { grid-template-columns: 1fr; }
                    .ai-reply-lab-head { display: grid; padding: 16px; }
                    .ai-reply-lab-safe { width: fit-content; }
                    .ai-reply-lab-controls, .ai-reply-lab-preview { padding: 16px; }
                    .ai-reply-lab-selects { grid-template-columns: 1fr; }
                    .ai-reply-lab-preview { min-height: 300px; }
                    .ai-runtime-card { padding: 15px 13px; }
                    .ai-runtime-head { display: grid; }
                    .ai-runtime-head .ant-btn { width: 100%; }
                    .ai-plan-grid, .ai-quota-grid, .ai-runtime-form-grid, .ai-runtime-tuning-grid { grid-template-columns: 1fr; }
                    .ai-runtime-form-grid .ant-form-item:last-child,
                    .ai-runtime-tuning-grid .ant-form-item:first-child { grid-column: auto; }
                    .ai-runtime-actions { display: grid; }
                    .ai-action-buttons { display: grid !important; grid-template-columns: 1fr 1fr; width: 100%; }
                    .ai-action-buttons .ant-btn { width: 100%; }
                    .bot-grid { grid-template-columns: minmax(0, 1fr); }
                    .bot-card { padding: 16px; }
                    .bot-overview-head { display: grid; }
                    .bot-active-summary { width: fit-content; }
                    .empty-state { grid-template-columns: 1fr; text-align: left; }
                    .empty-state .ant-btn { width: 100%; }
                }
            `}</style>

            <div className="chatbot-page">
                {/* Hero */}
                <div className="bot-hero">
                    <div>
                        <div className="bot-hero-kicker">AI & tự động hóa</div>
                        <h1 className="bot-hero-title">Trung tâm AI CSKH</h1>
                        <div className="bot-hero-copy">
                            Bật trợ lý theo từng kênh, gắn tri thức nội bộ và kiểm soát rõ lúc AI trả lời, lúc agent người thật tiếp quản.
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Zap size={16} color="#6366f1" />
                            <span style={{ fontWeight: 600, color: '#4338ca' }}>{bots.length} Bot</span>
                        </div>
                    </div>
                </div>

                <div className="ai-ops-guide" aria-label="Quy trình vận hành AI">
                    {[
                        ['01', 'Chọn bot & kênh', 'Bật đúng trợ lý cho Website, Zalo hoặc Facebook.', 'bots'],
                        ['02', 'Nạp tri thức', 'Đưa bảng giá, FAQ và chính sách vào Kho tri thức.', 'knowledge'],
                        ['03', 'Định giọng trả lời', 'Dùng kịch bản và mẫu trả lời để AI bớt máy móc.', 'macros'],
                        ['04', 'Theo dõi tiếp quản', 'Agent nhắn thủ công sẽ tạm dừng AI riêng cho khách đó.', 'inbox'],
                    ].map(([number, title, copy, destination]) => (
                        <button
                            key={number}
                            type="button"
                            className="ai-ops-step"
                            onClick={() => destination === 'bots'
                                ? document.getElementById('bot-overview-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                : router.push(`/workspace/${wsId}/${destination}`)}
                        >
                            <span className="ai-ops-number">{number}</span>
                            <span className="ai-ops-title">{title}</span>
                            <span className="ai-ops-copy">{copy}</span>
                        </button>
                    ))}
                </div>

                <section className="ai-reply-lab" aria-labelledby="ai-reply-lab-title">
                    <div className="ai-reply-lab-head">
                        <div>
                            <h2 id="ai-reply-lab-title">Phòng thử phản hồi AI</h2>
                            <p>Giả lập đúng bot, kênh và kho tri thức trước khi để AI trả lời khách thật.</p>
                        </div>
                        <span className="ai-reply-lab-safe">
                            <span style={{ width: 7, height: 7, borderRadius: 99, background: '#12b76a' }} />
                            Không gửi ra kênh
                        </span>
                    </div>
                    <div className="ai-reply-lab-grid">
                        <div className="ai-reply-lab-controls">
                            <div className="ai-reply-lab-selects">
                                <label>
                                    <span className="ai-reply-lab-label">Bot cần thử</span>
                                    <Select
                                        value={previewBotId || undefined}
                                        onChange={setPreviewBotId}
                                        placeholder="Chọn bot"
                                        style={{ width: '100%' }}
                                        options={bots.map(bot => ({
                                            value: bot.id,
                                            label: `${bot.name}${bot.isActive ? ' · đang bật' : ' · bản nháp/tạm tắt'}`,
                                        }))}
                                    />
                                </label>
                                <label>
                                    <span className="ai-reply-lab-label">Kênh giả lập</span>
                                    <Select
                                        value={previewChannel}
                                        onChange={setPreviewChannel}
                                        style={{ width: '100%' }}
                                        options={[
                                            { value: 'website', label: 'Website' },
                                            { value: 'zalo', label: 'Zalo' },
                                            { value: 'messenger', label: 'Facebook' },
                                            { value: 'instagram', label: 'Instagram' },
                                        ]}
                                    />
                                </label>
                            </div>
                            <label className="ai-reply-lab-field" style={{ display: 'block' }}>
                                <span className="ai-reply-lab-label">Nhu cầu đang dang dở <span style={{ color: '#98a2b3', fontWeight: 600 }}>(không bắt buộc)</span></span>
                                <TextArea
                                    value={previewContext}
                                    onChange={event => setPreviewContext(event.target.value)}
                                    placeholder="Ví dụ: Trước đó khách đang hỏi gói VPS cho website bán hàng..."
                                    autoSize={{ minRows: 2, maxRows: 4 }}
                                    maxLength={4000}
                                />
                            </label>
                            <label className="ai-reply-lab-field" style={{ display: 'block' }}>
                                <span className="ai-reply-lab-label">Tin nhắn giả định của khách</span>
                                <TextArea
                                    value={previewMessage}
                                    onChange={event => setPreviewMessage(event.target.value)}
                                    placeholder="Nhập tin khách có thể nhắn, kể cả các tin ngắn như a, aa, ok..."
                                    autoSize={{ minRows: 3, maxRows: 7 }}
                                    maxLength={4000}
                                    showCount
                                />
                            </label>
                            <Button
                                type="primary"
                                icon={<Sparkles size={15} />}
                                onClick={handlePreviewReply}
                                loading={previewLoading}
                                disabled={!bots.length}
                                style={{ width: '100%', height: 42, marginTop: 18, borderRadius: 10, background: '#2563eb', border: 0, fontWeight: 850 }}
                            >
                                Tạo phản hồi thử
                            </Button>
                            <div className="ai-reply-lab-hint">
                                Bản thử không gửi ra kênh và không trừ quota. Hãy thử cả câu ngắn, câu hỏi danh tính và tình huống thiếu dữ liệu trước khi bật bot.
                            </div>
                        </div>

                        <div className="ai-reply-lab-preview" aria-live="polite">
                            <div className="ai-reply-lab-meta">
                                <span className="ai-reply-lab-pill">Bản xem trước nội bộ</span>
                                {replyPreview?.source && (
                                    <span className="ai-reply-lab-pill">Nguồn: {PREVIEW_SOURCE_LABELS[replyPreview.source] || replyPreview.source}</span>
                                )}
                                {replyPreview?.latencyMs !== undefined && (
                                    <span className="ai-reply-lab-pill">Xử lý: {replyPreview.latencyMs}ms</span>
                                )}
                                {replyPreview?.deliveryDelayMs !== undefined && (
                                    <span className="ai-reply-lab-pill">
                                        Nhịp gửi: {replyPreview.deliveryDelayMs > 0
                                            ? `+${(replyPreview.deliveryDelayMs / 1000).toFixed(1)}s`
                                            : 'ngay'}
                                    </span>
                                )}
                                {replyPreview?.typingIndicator && (
                                    <span className="ai-reply-lab-pill">
                                        {replyPreview.typingLabel || 'Đang trả lời…'}
                                    </span>
                                )}
                                {(replyPreview?.responseParts?.length || 0) > 1 && (
                                    <span className="ai-reply-lab-pill">
                                        {replyPreview!.responseParts!.length} tin · nghỉ {((replyPreview?.interMessageDelayMs || 0) / 1000).toFixed(2)}s
                                    </span>
                                )}
                            </div>
                            {replyPreview ? (
                                <div className="ai-reply-lab-chat">
                                    {previewContext.trim() && (
                                        <div className="ai-reply-bubble customer" style={{ opacity: .72 }}>{previewContext.trim()}</div>
                                    )}
                                    <div className="ai-reply-bubble customer">{previewMessage.trim()}</div>
                                    {(replyPreview.responseParts?.length
                                        ? replyPreview.responseParts
                                        : [replyPreview.response]
                                    ).map((part, index) => (
                                        <div className="ai-reply-bubble bot" key={`${part}-${index}`}>
                                            {index === 0 && (
                                                <div style={{ marginBottom: 5, color: '#2563eb', fontSize: 10.5, fontWeight: 850 }}>{replyPreview.botName}</div>
                                            )}
                                            {part}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="ai-reply-lab-empty">
                                    <Brain size={28} color="#818cf8" style={{ marginBottom: 8 }} />
                                    <strong>Thử trước, bật sau</strong>
                                    Kết quả sẽ hiện như một đoạn chat thật để bạn đánh giá giọng điệu, độ dài và mức bám tri thức.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <div className="ai-settings-heading">
                    <div>
                        <h2>Cấu hình nâng cao</h2>
                        <p>Model, quota và gateway dùng chung cho workspace.</p>
                    </div>
                    <Tag color={aiRuntime?.enabled ? 'success' : 'default'} style={{ margin: 0, borderRadius: 6 }}>
                        {aiRuntime?.enabled ? 'Đang vận hành' : 'Đang tắt'}
                    </Tag>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) 360px', gap: 18, marginBottom: 24 }} className="ai-runtime-grid">
                    <div className="ai-runtime-card">
                        <div className="ai-runtime-head">
                            <div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: aiRuntime?.enabled ? '#ecfdf5' : '#f8fafc', color: aiRuntime?.enabled ? '#059669' : '#64748b', fontSize: 12, fontWeight: 800 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: aiRuntime?.enabled ? '#12b76a' : '#94a3b8' }} />
                                    {aiRuntime?.enabled ? 'Gateway VPS 24/7 đang bật' : 'Gateway VPS 24/7 đang tắt'}
                                </div>
                                <h2 style={{ margin: '12px 0 6px', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Gói AI tự động phản hồi khách hàng</h2>
                                <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                                    Workspace gọi cổng VPS 24/7; VPS kiểm soát quota rồi chuyển tiếp sang máy AI local khi máy đang online.
                                </p>
                                <div className="ai-plan-grid">
                                    {[
                                        ['Starter', '500 lượt AI/tháng', '#7c3aed'],
                                        ['Pro', 'Auto-reply đa kênh', '#d97706'],
                                        ['Enterprise', 'Gateway riêng + SLA', '#0284c7'],
                                    ].map(([plan, note, color]) => (
                                        <div key={plan} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: '#f8fafc' }}>
                                            <div style={{ color, fontSize: 12, fontWeight: 900 }}>{plan}</div>
                                            <div style={{ color: '#334155', fontSize: 12, fontWeight: 700, marginTop: 3 }}>{note}</div>
                                        </div>
                                    ))}
                                </div>
                                {aiQuota && (
                                    <div className="ai-quota-grid">
                                        {[
                                            ['Gói hiện tại', aiQuota.planId.toUpperCase()],
                                            ['Đã dùng', `${aiQuota.used}${aiQuota.limit === null ? '' : `/${aiQuota.limit}`}`],
                                            ['Còn lại', aiQuota.remaining === null ? 'Không giới hạn' : aiQuota.remaining],
                                            ['Reset', new Date(aiQuota.periodEnd).toLocaleDateString('vi-VN')],
                                        ].map(([label, value]) => (
                                            <div key={label} style={{ border: '1px solid #dbeafe', borderRadius: 10, padding: '9px 11px', background: '#eff6ff' }}>
                                                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0 }}>{label}</div>
                                                <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 900, marginTop: 3 }}>{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button onClick={fetchAIRuntime} loading={aiLoading} style={{ borderRadius: 10, fontWeight: 700 }}>
                                Tải lại
                            </Button>
                        </div>

                        <Spin spinning={aiLoading}>
                            <Form form={aiForm} layout="vertical" initialValues={{ enabled: true, provider: 'openai-compatible', baseUrl: NEMARK_AI_GATEWAY, model: DEFAULT_SMART_MODEL, temperature: 0.55, maxTokens: 700, timeoutMs: 60000 }}>
                                <Form.Item label="Preset cấu hình nhanh">
                                    <Select
                                        placeholder="Chọn preset model/gateway cho khách"
                                        options={AI_RUNTIME_PRESETS.map(preset => ({
                                            value: preset.key,
                                            label: preset.label,
                                        }))}
                                        onChange={applyAIRuntimePreset}
                                    />
                                    <div style={{ marginTop: 8, color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>
                                        Khuyên dùng <strong>qwen2.5:14b</strong> cho CSKH/bán hàng tiếng Việt. Nếu PC local AI tắt, hãy dùng preset fallback cloud để khách vẫn có phản hồi.
                                    </div>
                                </Form.Item>
                                <div className="ai-runtime-form-grid">
                                    <Form.Item name="enabled" label="Trạng thái" valuePropName="checked">
                                        <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                                    </Form.Item>
                                    <Form.Item name="provider" label="Provider">
                                        <Select options={[
                                            { value: 'openai-compatible', label: 'Nemark AI Cloud' },
                                        ]} disabled />
                                    </Form.Item>
                                    <Form.Item name="model" label="Model thực tế">
                                        <Select
                                            mode="tags"
                                            showSearch
                                            allowClear
                                            maxTagCount={1}
                                            placeholder={DEFAULT_SMART_MODEL}
                                            options={AI_MODEL_OPTIONS}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item
                                    name="baseUrl"
                                    label="AI Gateway công khai (VPS 24/7)"
                                    extra={(
                                        <span>
                                            <code>{NEMARK_AI_GATEWAY}</code> là cổng ổn định cho workspace. <code>{LOCAL_AI_GATEWAY}</code> là upstream RTX/Ollama trên PC, chỉ VPS hoặc khách private có key mới nên gọi trực tiếp.
                                        </span>
                                    )}
                                >
                                    <Input placeholder={NEMARK_AI_GATEWAY} />
                                </Form.Item>
                                <div className="ai-runtime-tuning-grid">
                                    <Form.Item name="apiKey" label="API key">
                                        <Input.Password placeholder={aiRuntime?.hasApiKey ? 'Để trống để giữ key hiện tại' : 'Dùng key gateway hệ thống nếu để trống'} />
                                    </Form.Item>
                                    <Form.Item name="temperature" label="Độ tự nhiên" extra="Khuyên dùng 0.5–0.7 để câu chữ tự nhiên nhưng vẫn bám dữ liệu.">
                                        <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item name="maxTokens" label="Max tokens">
                                        <InputNumber min={64} max={4096} step={64} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item name="timeoutMs" label="Timeout">
                                        <InputNumber min={3000} max={120000} step={1000} addonAfter="ms" style={{ width: '100%' }} />
                                    </Form.Item>
                                </div>
                                <div className="ai-runtime-actions">
                                    <div style={{ color: '#64748b', fontSize: 12 }}>
                                        Cổng workspace: <code>{NEMARK_AI_GATEWAY}</code> · Upstream AI local: <code>{LOCAL_AI_GATEWAY}</code>. Quota auto-reply tính theo gói. Key đang lưu: <strong>{aiRuntime?.hasApiKey ? 'có' : 'chưa có'}</strong>.
                                    </div>
                                    <div style={{ color: '#334155', fontSize: 12, fontWeight: 750 }}>
                                        Đang chọn: <code>{selectedRuntimeGateway || NEMARK_AI_GATEWAY}</code> · <strong>{selectedRuntimeModel || DEFAULT_SMART_MODEL}</strong>
                                    </div>
                                    <Space className="ai-action-buttons">
                                        <Button onClick={handleTestAIRuntime} loading={aiTesting} style={{ borderRadius: 10, fontWeight: 800 }}>
                                            Test kết nối
                                        </Button>
                                        <Button type="primary" onClick={handleSaveAIRuntime} loading={aiSaving} style={{ borderRadius: 10, fontWeight: 800 }}>
                                            Lưu cấu hình
                                        </Button>
                                    </Space>
                                </div>
                                {aiTestResult && (
                                    <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 13, fontWeight: 700 }}>
                                        Kết nối OK · Nemark AI Gateway · {aiTestResult.model} · {aiTestResult.latencyMs}ms · phản hồi: {aiTestResult.sample || 'ok'}
                                    </div>
                                )}
                            </Form>
                        </Spin>
                    </div>

                    <div className="ai-deploy-card">
                        <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0 }}>Kiến trúc deploy</div>
                        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                            {[
                                ['Admin Dashboard', 'Lưu cấu hình và quota theo workspace'],
                                ['Public API Gateway · VPS 24/7', NEMARK_AI_GATEWAY],
                                ['AI Auto-reply Engine', 'RAG + kịch bản + kiểm duyệt'],
                                ['Local RTX/Ollama upstream', `${LOCAL_AI_GATEWAY} · hoạt động khi PC/tunnel online`],
                                ['Channel Worker', 'Website, Zalo, Facebook, Email'],
                            ].map(([title, desc], index) => (
                                <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 8, background: index === 2 ? '#22c55e' : '#334155', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 12 }}>{index + 1}</div>
                                    <div>
                                        <div style={{ fontWeight: 850, color: '#fff', fontSize: 13 }}>{title}</div>
                                        <div style={{ color: '#94a3b8', fontSize: 12 }}>{desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 18, padding: 12, borderRadius: 14, background: 'rgba(99,102,241,0.16)', border: '1px solid rgba(129,140,248,0.28)', color: '#c7d2fe', fontSize: 12, lineHeight: 1.55 }}>
                            Khi agent trả lời thủ công trong Inbox, hội thoại tự chuyển sang chế độ người thật để AI không trả lời chồng. Có thể bật lại AI ngay trên thanh Nemark AI Copilot của khách đó.
                        </div>
                    </div>
                </div>

                {/* Bot List */}
                <section className="bot-overview" aria-labelledby="bot-overview-title">
                    <div className="bot-overview-head">
                        <div>
                            <h2 id="bot-overview-title">Trợ lý đang phục vụ khách hàng</h2>
                            <p>Quản lý trạng thái, kênh hoạt động và hiệu suất ngay tại đây.</p>
                        </div>
                        <span className="bot-active-summary">
                            {bots.filter(bot => bot.isActive).length} đang hoạt động
                        </span>
                    </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
                ) : bots.length === 0 ? (
                    <div className="empty-state">
                        <div className="bot-card-avatar" aria-hidden="true">
                            <Bot size={24} color="#fff" strokeWidth={1.8} />
                        </div>
                        <div className="empty-state-copy">
                            <strong>Chưa có trợ lý AI</strong>
                            <span>Tạo trợ lý đầu tiên để bắt đầu tự động phản hồi khách hàng.</span>
                        </div>
                        <Button
                            type="primary"
                            icon={<Plus size={16} />}
                            onClick={handleCreate}
                            style={{ background: '#2563eb', border: 'none', borderRadius: 8, height: 40, fontWeight: 700 }}
                        >
                            Tạo Bot AI
                        </Button>
                    </div>
                ) : (
                    <div className="bot-grid">
                        {bots.map(bot => (
                            <div key={bot.id} className="bot-card" onClick={() => handleEdit(bot)}>
                                <div className="bot-card-header">
                                    <div className="bot-card-avatar">
                                        {bot.avatarUrl ? (
                                            <Avatar src={bot.avatarUrl} size={48} style={{ borderRadius: 14 }} />
                                        ) : (
                                            <Bot size={24} color="#fff" />
                                        )}
                                    </div>
                                    <div className="bot-card-title">
                                        <div className="bot-card-title-name" title={bot.name}>{bot.name}</div>
                                        <div className="bot-card-meta">
                                            <Tag color={bot.isActive ? 'green' : bot.isDraft ? 'orange' : 'default'} style={{ margin: 0, borderRadius: 6, fontSize: 12 }}>
                                                {bot.isActive ? 'Active' : bot.isDraft ? 'Draft' : 'Inactive'}
                                            </Tag>
                                            <span className="bot-card-task" title={TASK_LABELS[bot.mainTask] || bot.mainTask}>
                                                {TASK_LABELS[bot.mainTask] || bot.mainTask}
                                            </span>
                                        </div>
                                    </div>
                                    <Switch
                                        className="bot-card-toggle"
                                        checked={bot.isActive}
                                        onChange={(checked, e) => {
                                            e.stopPropagation();
                                            handleToggle(bot.id, checked);
                                        }}
                                        checkedChildren={<Power size={12} />}
                                        unCheckedChildren={<PowerOff size={12} />}
                                    />
                                </div>

                                {/* Channels */}
                                <div className="bot-card-channels">
                                    {Object.entries(CHANNEL_META).map(([key, meta]) => {
                                        const enabled = bot.channels?.[key as keyof typeof bot.channels]?.enabled;
                                        if (!enabled) return null;
                                        const Icon = meta.icon;
                                        return (
                                            <Tag key={key} style={{ borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
                                                <Icon size={12} /> {meta.label}
                                            </Tag>
                                        );
                                    })}
                                </div>

                                {/* Stats */}
                                <div className="bot-card-stats">
                                    <div className="bot-stat">
                                        <div className="bot-stat-val">{bot.stats?.totalConversations || 0}</div>
                                        <div className="bot-stat-label">Hội thoại</div>
                                    </div>
                                    <div className="bot-stat">
                                        <div className="bot-stat-val">{bot.stats?.totalReplies || 0}</div>
                                        <div className="bot-stat-label">Trả lời</div>
                                    </div>
                                    <div className="bot-stat">
                                        <div className="bot-stat-val">{bot.stats?.leadsCollected || 0}</div>
                                        <div className="bot-stat-label">Leads</div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="bot-card-actions" onClick={e => e.stopPropagation()}>
                                    <Button size="small" icon={<Pencil size={14} />} onClick={() => handleEdit(bot)}>Sửa</Button>
                                    <Button size="small" danger icon={<Trash2 size={14} />} onClick={() => handleDelete(bot.id)}>Xóa</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </section>
            </div>
        </AppLayout>
    );
}
