import axios from 'axios';
import prisma from '../../infra/prisma';
import { ConversationModel } from '../conversation/repos/conversation.model';
import { MessageModel } from '../conversation/repos/message.model';
import mongoose from 'mongoose';

// ── AI API configuration ──
const AI_API_URL = process.env.AI_API_URL || 'https://rk674rm.9router.com/v1';
const AI_API_KEY = process.env.AI_API_KEY || 'sk-9aab752cd2d2aaf7-shwqj4-1ec380e6';
const AI_MODEL = process.env.AI_MODEL || 'gpt-5';

// ── Analysis result interface ──
export interface AIAnalysisResult {
    name?: string;
    phone?: string;
    email?: string;
    intent?: 'mua_hàng' | 'hỏi_giá' | 'hỗ_trợ' | 'khiếu_nại' | 'khác';
    score?: number; // 0-100 lead potential score
    summary?: string;
    tags?: string[];
    products?: string[]; // products/services mentioned
    sentiment?: 'tích_cực' | 'trung_lập' | 'tiêu_cực';
    urgency?: 'cao' | 'trung_bình' | 'thấp';
}

// ── Intent labels for display ──
export const INTENT_LABELS: Record<string, string> = {
    'mua_hàng': '🛒 Muốn mua hàng',
    'hỏi_giá': '💰 Hỏi giá',
    'hỗ_trợ': '🔧 Cần hỗ trợ',
    'khiếu_nại': '⚠️ Khiếu nại',
    'khác': '💬 Khác',
};

// ── Stage mapping from intent ──
const INTENT_TO_STAGE: Record<string, string> = {
    'mua_hàng': 'chốt_đơn',
    'hỏi_giá': 'đang_tư_vấn',
    'hỗ_trợ': 'khách_hàng',
    'khiếu_nại': 'khách_hàng',
    'khác': 'mới',
};

const STAGE_ORDER = ['mới', 'tiềm_năng', 'đang_tư_vấn', 'chốt_đơn', 'khách_hàng'];

/**
 * Build the analysis prompt for AI
 */
function buildAnalysisPrompt(): string {
    return `Bạn là trợ lý AI chuyên phân tích cuộc hội thoại chăm sóc khách hàng.
Hãy phân tích cuộc hội thoại bên dưới và trích xuất thông tin theo JSON format:

{
  "name": "Tên khách hàng (nếu tìm thấy, null nếu không)",
  "phone": "Số điện thoại (nếu tìm thấy, null nếu không)",
  "email": "Email (nếu tìm thấy, null nếu không)",
  "intent": "mua_hàng | hỏi_giá | hỗ_trợ | khiếu_nại | khác",
  "score": 0-100 (điểm tiềm năng mua hàng: 80-100=rất có khả năng mua, 50-79=tiềm năng, 20-49=thấp, 0-19=không quan tâm),
  "summary": "Tóm tắt nội dung cuộc hội thoại trong 1-2 câu ngắn gọn",
  "tags": ["tag1", "tag2"] (các tag mô tả ngắn gọn nhu cầu/đặc điểm khách hàng),
  "products": ["sản phẩm/dịch vụ được nhắc đến"],
  "sentiment": "tích_cực | trung_lập | tiêu_cực",
  "urgency": "cao | trung_bình | thấp"
}

Quy tắc:
- Chỉ trả về JSON thuần, KHÔNG có markdown, KHÔNG có giải thích.
- Số điện thoại VN thường có dạng 0xxx.xxx.xxx hoặc +84xxx.
- Email có dạng abc@domain.com.
- Nếu không tìm thấy thông tin, dùng null.
- Tags nên ngắn gọn, ví dụ: "quan tâm giá", "cần tư vấn", "khách VIP", "mua sỉ".
- Score dựa trên mức độ quan tâm thực sự (có hỏi giá, yêu cầu đặt hàng = score cao).`;
}

/**
 * Call AI API to analyze a conversation
 */
async function callAIAnalysis(conversationText: string): Promise<AIAnalysisResult | null> {
    try {
        console.log(`[LeadAI] Calling AI analysis (${conversationText.length} chars)...`);

        const response = await axios.post(
            `${AI_API_URL}/chat/completions`,
            {
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: buildAnalysisPrompt() },
                    { role: 'user', content: `Phân tích cuộc hội thoại sau:\n\n${conversationText}` },
                ],
                max_tokens: 800,
                temperature: 0.3,
                top_p: 0.9,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${AI_API_KEY}`,
                },
                timeout: 60000,
            }
        );

        const reply = response.data?.choices?.[0]?.message?.content;
        if (!reply) {
            console.warn('[LeadAI] ⚠️ Empty response from AI');
            return null;
        }

        let jsonStr = reply.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        }
        
        const parsed = JSON.parse(jsonStr) as AIAnalysisResult;
        console.log(`[LeadAI] ✅ Analysis complete:`, {
            name: parsed.name, phone: parsed.phone, email: parsed.email,
            intent: parsed.intent, score: parsed.score,
        });
        return parsed;
    } catch (err: any) {
        if (err instanceof SyntaxError) {
            console.error('[LeadAI] ❌ Failed to parse AI response as JSON:', err.message);
        } else {
            console.error('[LeadAI] ❌ AI call failed:', err?.response?.status, err?.response?.data || err.message);
        }
        return null;
    }
}

/**
 * Format conversation messages into readable text for AI analysis
 */
function formatConversationForAI(messages: any[]): string {
    return messages
        .filter(m => !m.isDeleted && m.content && m.type === 'text')
        .map(m => {
            const role = m.sender?.type === 'visitor' ? 'Khách' : (m.sender?.type === 'agent' ? 'Nhân viên' : 'Hệ thống');
            const name = m.sender?.name ? ` (${m.sender.name})` : '';
            return `[${role}${name}]: ${m.content}`;
        })
        .join('\n');
}

export const leadAIService = {
    /**
     * Analyze a single conversation and extract customer info
     * Creates or updates the corresponding Lead automatically (via Prisma)
     */
    async analyzeConversation(
        workspaceId: string,
        conversationId: string,
        options?: { autoCreateLead?: boolean; forceReanalyze?: boolean }
    ): Promise<{ analysis: AIAnalysisResult | null; lead: any | null; conversationId: string }> {
        const { autoCreateLead = true } = options || {};

        // 1. Get conversation (Mongoose)
        const conversation = await ConversationModel.findById(conversationId).lean();
        if (!conversation) {
            throw new Error('Cuộc hội thoại không tồn tại');
        }

        // 2. Get messages (Mongoose)
        const messages = await MessageModel.find({ conversationId: new mongoose.Types.ObjectId(conversationId) })
            .sort({ createdAt: 1 })
            .limit(50)
            .lean();

        if (messages.length < 2) {
            console.log(`[LeadAI] Conversation ${conversationId} has too few messages (${messages.length}), skipping`);
            return { analysis: null, lead: null, conversationId };
        }

        // 3. Format & analyze
        const conversationText = formatConversationForAI(messages);
        if (conversationText.length < 20) {
            return { analysis: null, lead: null, conversationId };
        }

        const analysis = await callAIAnalysis(conversationText);
        if (!analysis) {
            return { analysis: null, lead: null, conversationId };
        }

        // 4. Store analysis result in conversation metadata (Mongoose)
        await ConversationModel.findByIdAndUpdate(conversationId, {
            $set: {
                'metadata.aiAnalysis': {
                    ...analysis,
                    analyzedAt: new Date(),
                    messageCount: messages.length,
                },
            },
        });

        // 5. Auto-create/update Lead if enabled (Prisma)
        let lead = null;
        if (autoCreateLead) {
            lead = await this.upsertLeadFromAnalysis(workspaceId, conversation, analysis);
        }

        return { analysis, lead, conversationId };
    },

    /**
     * Create or update a Lead from AI analysis results (Prisma)
     */
    async upsertLeadFromAnalysis(
        workspaceId: string,
        conversation: any,
        analysis: AIAnalysisResult
    ): Promise<any> {
        const visitorId = conversation.visitorId;
        const channel = conversation.channel || 'widget';

        const sourceMap: Record<string, string> = { 'zalo': 'zalo', 'facebook': 'facebook', 'widget': 'widget' };
        const source = sourceMap[channel] || 'widget';

        // Look for existing lead by platform userId (Prisma)
        let existingLead = null;
        let lookupField = '';
        let lookupValue = '';

        if (channel === 'zalo') {
            lookupField = 'zaloUserId';
            lookupValue = conversation.metadata?.zaloUserId || visitorId.replace('zalo_', '');
            existingLead = await prisma.lead.findFirst({ where: { workspaceId, zaloUserId: lookupValue } });
        } else if (channel === 'facebook') {
            lookupField = 'fbUserId';
            lookupValue = conversation.metadata?.fbUserId || visitorId.replace('fb_', '');
            existingLead = await prisma.lead.findFirst({ where: { workspaceId, fbUserId: lookupValue } });
        }

        // Also try matching by name if no platform match
        if (!existingLead && conversation.visitorInfo?.name) {
            existingLead = await prisma.lead.findFirst({
                where: { workspaceId, name: conversation.visitorInfo.name, source },
            });
        }

        // Build AI tags
        const aiTags: string[] = [];
        if (analysis.intent) aiTags.push(`intent:${analysis.intent}`);
        if (analysis.sentiment) aiTags.push(`sentiment:${analysis.sentiment}`);
        if (analysis.urgency) aiTags.push(`urgency:${analysis.urgency}`);
        if (analysis.products?.length) analysis.products.forEach(p => aiTags.push(`product:${p}`));
        if (analysis.tags?.length) analysis.tags.forEach(t => aiTags.push(t));

        // Build AI note
        const aiNote = analysis.summary
            ? `🤖 AI Phân tích: ${analysis.summary}${analysis.intent ? ` | Ý định: ${INTENT_LABELS[analysis.intent] || analysis.intent}` : ''}${analysis.score !== undefined ? ` | Score: ${analysis.score}/100` : ''}`
            : null;

        if (existingLead) {
            // Update existing lead
            const updates: any = {};
            if (analysis.phone && analysis.phone !== 'null' && !existingLead.phone) updates.phone = analysis.phone;
            if (analysis.email && analysis.email !== 'null' && !existingLead.email) updates.email = analysis.email;
            if (analysis.score !== undefined && analysis.score !== null) updates.score = Math.min(100, Math.max(0, analysis.score));

            // Update name from AI if visitor has generic name
            if (analysis.name && analysis.name !== 'null' && (!existingLead.name || existingLead.name.startsWith('Thành viên'))) {
                updates.name = analysis.name;
            }

            // Suggested stage from intent (only upgrade, never downgrade)
            if (analysis.intent && INTENT_TO_STAGE[analysis.intent]) {
                const suggestedStage = INTENT_TO_STAGE[analysis.intent];
                const currentIdx = STAGE_ORDER.indexOf(existingLead.stage);
                const suggestedIdx = STAGE_ORDER.indexOf(suggestedStage);
                if (suggestedIdx > currentIdx && existingLead.stage !== 'từ_chối') {
                    updates.stage = suggestedStage;
                }
            }

            // Merge tags (avoid duplicates)
            const existingTags = (existingLead.tags as string[]) || [];
            const mergedTags = [...new Set([...existingTags, ...aiTags])];
            updates.tags = mergedTags;

            // Add AI note
            if (aiNote) {
                const existingNotes = (existingLead.notes as any[]) || [];
                existingNotes.push({ text: aiNote, createdAt: new Date(), createdBy: null });
                updates.notes = existingNotes;
            }

            const updated = await prisma.lead.update({ where: { id: existingLead.id }, data: updates });
            console.log(`[LeadAI] ✅ Updated lead ${existingLead.id} with AI analysis`);
            return updated;
        } else {
            // Create new lead
            const visitorName = analysis.name || conversation.visitorInfo?.name || `Khách ${visitorId.slice(-6)}`;
            const newLead = await prisma.lead.create({
                data: {
                    workspaceId,
                    name: visitorName,
                    phone: (analysis.phone && analysis.phone !== 'null') ? analysis.phone : '',
                    email: (analysis.email && analysis.email !== 'null') ? analysis.email : '',
                    avatar: conversation.visitorInfo?.avatar || '',
                    stage: (analysis.intent ? (INTENT_TO_STAGE[analysis.intent] || 'mới') : 'mới'),
                    source,
                    score: Math.min(100, Math.max(0, analysis.score || 0)),
                    tags: aiTags,
                    ...(channel === 'zalo' ? { zaloUserId: lookupValue } : {}),
                    ...(channel === 'facebook' ? { fbUserId: lookupValue } : {}),
                    lastContactedAt: new Date(),
                    conversationCount: 1,
                    notes: aiNote ? [{ text: aiNote, createdAt: new Date(), createdBy: null }] : [],
                },
            });
            console.log(`[LeadAI] ✅ Created new lead ${newLead.id} from AI analysis`);
            return newLead;
        }
    },

    /**
     * Bulk analyze all conversations in a workspace
     * Only analyzes conversations that haven't been analyzed yet (or analyzed > 24h ago)
     */
    async analyzeBulk(
        workspaceId: string,
        options?: { limit?: number; forceReanalyze?: boolean }
    ): Promise<{
        total: number;
        analyzed: number;
        skipped: number;
        failed: number;
        results: Array<{ conversationId: string; status: string; intent?: string; score?: number }>;
    }> {
        const { limit = 50, forceReanalyze = false } = options || {};
        const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const filter: any = {
            workspaceId: new mongoose.Types.ObjectId(workspaceId),
        };

        if (!forceReanalyze) {
            filter.$or = [
                { 'metadata.aiAnalysis': { $exists: false } },
                { 'metadata.aiAnalysis.analyzedAt': { $lt: cutoffDate } },
            ];
        }

        const conversations = await ConversationModel.find(filter)
            .sort({ lastMessageAt: -1 })
            .limit(limit)
            .select('_id visitorId visitorInfo channel metadata')
            .lean();

        let analyzed = 0;
        let skipped = 0;
        let failed = 0;
        const results: Array<{ conversationId: string; status: string; intent?: string; score?: number }> = [];

        for (const conv of conversations) {
            try {
                const result = await this.analyzeConversation(
                    workspaceId,
                    (conv._id as any).toString(),
                    { autoCreateLead: true }
                );

                if (result.analysis) {
                    analyzed++;
                    results.push({
                        conversationId: (conv._id as any).toString(),
                        status: 'analyzed',
                        intent: result.analysis.intent,
                        score: result.analysis.score,
                    });
                } else {
                    skipped++;
                    results.push({
                        conversationId: (conv._id as any).toString(),
                        status: 'skipped',
                    });
                }

                // Rate limiting: wait 1s between calls
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err: any) {
                failed++;
                results.push({
                    conversationId: (conv._id as any).toString(),
                    status: 'failed',
                });
                console.error(`[LeadAI] Failed to analyze conv ${(conv._id as any).toString()}:`, err.message);
            }
        }

        return { total: conversations.length, analyzed, skipped, failed, results };
    },

    /**
     * Quick analysis: extract just phone/email/name from recent messages
     * Used for auto-extraction hook (lightweight, no full AI call)
     */
    async quickExtract(
        workspaceId: string,
        conversationId: string,
        recentMessages: Array<{ sender: any; content: string }>
    ): Promise<void> {
        try {
            const visitorMessages = recentMessages
                .filter(m => m.sender?.type === 'visitor' && m.content)
                .map(m => m.content)
                .join(' ');

            if (visitorMessages.length < 10) return;

            const phoneMatch = visitorMessages.match(/(?:\+84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}/);
            const emailMatch = visitorMessages.match(/[\w.+-]+@[\w-]+\.[\w.]+/);

            if (!phoneMatch && !emailMatch) return;

            const conversation = await ConversationModel.findById(conversationId).lean();
            if (!conversation) return;

            const channel = (conversation as any).channel || 'widget';
            let lead = null;

            if (channel === 'zalo') {
                const zaloUserId = (conversation as any).metadata?.zaloUserId || conversation.visitorId.replace('zalo_', '');
                lead = await prisma.lead.findFirst({ where: { workspaceId, zaloUserId } });
            } else if (channel === 'facebook') {
                const fbUserId = (conversation as any).metadata?.fbUserId || conversation.visitorId.replace('fb_', '');
                lead = await prisma.lead.findFirst({ where: { workspaceId, fbUserId } });
            }

            if (lead) {
                const updates: any = {};
                if (phoneMatch && !lead.phone) updates.phone = phoneMatch[0].replace(/[\s.-]/g, '');
                if (emailMatch && !lead.email) updates.email = emailMatch[0];

                if (Object.keys(updates).length > 0) {
                    await prisma.lead.update({ where: { id: lead.id }, data: updates });
                    console.log(`[LeadAI] Quick-extracted info for lead ${lead.id}:`, updates);
                }
            }
        } catch (err) {
            console.error('[LeadAI] Quick extract error:', err);
        }
    },

    /**
     * Get AI analysis for a conversation (from cache/metadata)
     */
    async getAnalysis(conversationId: string): Promise<AIAnalysisResult | null> {
        const conv = await ConversationModel.findById(conversationId).select('metadata').lean();
        return (conv as any)?.metadata?.aiAnalysis || null;
    },

    /**
     * Get lead activity timeline — combines messages, stage changes, and notes
     */
    async getLeadTimeline(workspaceId: string, leadId: string): Promise<any[]> {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) throw new Error('Lead không tồn tại');

        const timeline: any[] = [];

        // Add notes to timeline
        const notes = (lead.notes as any[]) || [];
        notes.forEach(note => {
            timeline.push({
                type: 'note',
                content: note.text,
                createdAt: note.createdAt,
                createdBy: note.createdBy,
                icon: note.text?.startsWith('🤖') ? 'ai' : 'note',
            });
        });

        // Find conversations linked to this lead
        const lookupId = lead.zaloUserId || lead.fbUserId || '';
        if (lookupId) {
            const prefix = lead.source === 'facebook' ? 'fb_' : 'zalo_';
            const conversations = await ConversationModel.find({
                visitorId: `${prefix}${lookupId}`,
            })
                .select('_id status lastMessageAt visitorInfo metadata createdAt')
                .sort({ lastMessageAt: -1 })
                .limit(10)
                .lean();

            for (const conv of conversations) {
                // Add conversation start event
                timeline.push({
                    type: 'conversation',
                    content: `Cuộc hội thoại ${conv.status === 'closed' ? '(đã đóng)' : '(đang mở)'}`,
                    createdAt: conv.createdAt,
                    conversationId: (conv._id as any).toString(),
                    status: conv.status,
                    icon: 'message',
                });

                // Get last 3 messages from this conversation
                const messages = await MessageModel.find({
                    conversationId: conv._id,
                    isDeleted: { $ne: true },
                    'sender.type': 'visitor',
                })
                    .sort({ createdAt: -1 })
                    .limit(3)
                    .lean();

                messages.reverse().forEach(msg => {
                    timeline.push({
                        type: 'message',
                        content: msg.content?.substring(0, 200) || '[Đính kèm]',
                        createdAt: msg.createdAt,
                        conversationId: (conv._id as any).toString(),
                        senderName: msg.sender?.name,
                        icon: 'chat',
                    });
                });
            }
        }

        // Add creation event
        timeline.push({
            type: 'created',
            content: `Lead được tạo từ ${lead.source}`,
            createdAt: lead.createdAt,
            icon: 'star',
        });

        // Sort by date (newest first)
        timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return timeline;
    },

    /**
     * Score all leads based on activity (batch job)
     * Updates score based on: message count, recency, conversation count
     */
    async autoScoreLeads(workspaceId: string): Promise<{ updated: number }> {
        const leads = await prisma.lead.findMany({
            where: { workspaceId, stage: { notIn: ['từ_chối', 'khách_hàng'] } },
        });

        let updated = 0;
        for (const lead of leads) {
            const lookupId = lead.zaloUserId || lead.fbUserId || '';
            if (!lookupId) continue;

            const prefix = lead.source === 'facebook' ? 'fb_' : 'zalo_';
            
            // Count conversations and messages for this lead
            const conversations = await ConversationModel.find({
                visitorId: `${prefix}${lookupId}`,
            }).select('_id lastMessageAt').lean();

            let totalMessages = 0;
            for (const conv of conversations) {
                const msgCount = await MessageModel.countDocuments({
                    conversationId: conv._id,
                    'sender.type': 'visitor',
                    isDeleted: { $ne: true },
                });
                totalMessages += msgCount;
            }

            // Calculate score
            let score = 0;
            // Messages factor (0-30 points)
            score += Math.min(30, totalMessages * 3);
            // Conversation count factor (0-20 points)
            score += Math.min(20, conversations.length * 5);
            // Recency factor (0-25 points)
            if (lead.lastContactedAt) {
                const daysSinceContact = (Date.now() - new Date(lead.lastContactedAt).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceContact < 1) score += 25;
                else if (daysSinceContact < 3) score += 20;
                else if (daysSinceContact < 7) score += 15;
                else if (daysSinceContact < 14) score += 10;
                else if (daysSinceContact < 30) score += 5;
            }
            // Contact info factor (0-15 points)
            if (lead.phone) score += 8;
            if (lead.email) score += 7;
            // Has been engaged before (0-10)
            if (lead.conversationCount > 0) score += Math.min(10, lead.conversationCount * 2);

            score = Math.min(100, score);

            // Update if score changed
            if (score !== lead.score) {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        score,
                        conversationCount: conversations.length,
                    },
                });
                updated++;
            }
        }

        console.log(`[LeadAI] Auto-scored ${updated}/${leads.length} leads in workspace ${workspaceId}`);
        return { updated };
    },
};
