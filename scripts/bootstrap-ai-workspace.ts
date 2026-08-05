import 'dotenv/config';
import { Prisma } from '@prisma/client';
import prisma from '../src/infra/prisma';
import { knowledgeService } from '../src/modules/knowledge/knowledge.service';

const MODEL_ALIAS = 'nemark-chat-v3';
const GATEWAY_URL = 'https://api.nemarkchat.com/v1';

const DEFAULT_KNOWLEDGE = [
    {
        product: 'NemarkChat',
        question: 'NemarkChat là gì?',
        answer: 'NemarkChat là nền tảng chăm sóc khách hàng đa kênh dành cho doanh nghiệp. Hệ thống tập trung hội thoại từ website, Zalo, Facebook và email vào một workspace để đội ngũ cùng xử lý, theo dõi SLA và dùng AI hỗ trợ phản hồi.',
    },
    {
        product: 'Kênh kết nối',
        question: 'NemarkChat hỗ trợ những kênh chăm sóc khách hàng nào?',
        answer: 'Tùy cấu hình workspace, NemarkChat có thể tập trung hội thoại từ website hoặc web chat, Zalo, Facebook hoặc Messenger và email vào một inbox chung để đội ngũ cùng xử lý.',
    },
    {
        product: 'AI tự động phản hồi',
        question: 'AI tự động phản hồi khách hàng hoạt động như thế nào?',
        answer: 'NemarkChat dùng thông tin doanh nghiệp cung cấp cùng ngữ cảnh trò chuyện để hỗ trợ trả lời nhanh. Nội dung nào chưa đủ dữ liệu hoặc cần xác nhận sẽ được để lại cho nhân viên phụ trách kiểm tra.',
    },
    {
        product: 'Gói dịch vụ',
        question: 'NemarkChat có những gói dịch vụ nào?',
        answer: 'NemarkChat có gói Dùng thử miễn phí 30 ngày, gói Khởi đầu từ 299.000 đồng mỗi tháng, gói Chuyên nghiệp 799.000 đồng mỗi tháng và gói Doanh nghiệp báo giá theo nhu cầu. Quyền lợi và giá áp dụng tại thời điểm đăng ký được hiển thị trong trang Gói và thanh toán.',
    },
    {
        product: 'Triển khai',
        question: 'Bắt đầu sử dụng NemarkChat như thế nào?',
        answer: 'Quy trình cơ bản gồm tạo workspace, kết nối các kênh đang dùng, thêm đội ngũ và giờ làm việc, nạp câu hỏi đáp vào Kho tri thức, cấu hình Nhân viên AI rồi kiểm thử trước khi bật tự động phản hồi cho khách hàng.',
    },
    {
        product: 'Bảo mật dữ liệu',
        question: 'NemarkChat bảo vệ dữ liệu khách hàng như thế nào?',
        answer: 'NemarkChat truyền dữ liệu qua HTTPS, tách dữ liệu theo từng workspace, kiểm soát quyền truy cập theo vai trò và lưu nhật ký các thao tác quan trọng. Doanh nghiệp chỉ nên cấp đúng quyền cần thiết và không đưa mật khẩu hoặc dữ liệu nhạy cảm vào nội dung chat.',
    },
    {
        product: 'Hỗ trợ và chuyển người thật',
        question: 'Khi AI không đủ thông tin thì xử lý thế nào?',
        answer: 'AI phải nói rõ chưa đủ thông tin, không tự bịa giá, chính sách, tình trạng đơn hàng hoặc cam kết. Bot sẽ xin thông tin liên hệ cần thiết và chuyển hội thoại cho nhân viên phụ trách để xác nhận.',
    },
];

const asObject = (value: Prisma.JsonValue | null): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

async function bootstrapWorkspace(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new Error(`Workspace không tồn tại: ${workspaceId}`);

    let created = 0;
    let updated = 0;

    for (const entry of DEFAULT_KNOWLEDGE) {
        const existing = await prisma.knowledgeEntry.findFirst({
            where: { workspaceId, question: entry.question },
            select: { id: true },
        });

        if (existing) {
            await knowledgeService.update(workspaceId, existing.id, entry);
            updated += 1;
        } else {
            await knowledgeService.create(workspaceId, entry);
            created += 1;
        }
    }

    const currentSettings = asObject(workspace.settings);
    const currentRuntime = asObject((currentSettings.aiRuntime as Prisma.JsonValue) || null);
    await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            settings: {
                ...currentSettings,
                aiRuntime: {
                    ...currentRuntime,
                    enabled: true,
                    provider: 'openai-compatible',
                    baseUrl: GATEWAY_URL,
                    model: MODEL_ALIAS,
                    temperature: 0.2,
                    maxTokens: 500,
                    timeoutMs: 60_000,
                    updatedAt: new Date().toISOString(),
                },
            } as Prisma.InputJsonValue,
        },
    });

    const existingBot = await prisma.aIBot.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
    });

    if (existingBot) {
        await prisma.aIBot.update({
            where: { id: existingBot.id },
            data: {
                name: /local/i.test(existingBot.name) ? 'Trợ lý AI Nemark' : existingBot.name,
                brandName: existingBot.brandName || 'NemarkChat',
                brandDescription: existingBot.brandDescription || 'Nền tảng chăm sóc khách hàng đa kênh và AI cho doanh nghiệp.',
                aiModel: MODEL_ALIAS,
                customGreeting: existingBot.customGreeting || 'Chào bạn, mình có thể hỗ trợ thông tin gì về NemarkChat hôm nay?',
            },
        });
    } else {
        await prisma.aIBot.create({
            data: {
                workspaceId,
                name: 'Trợ lý AI Nemark',
                brandName: 'NemarkChat',
                brandDescription: 'Nền tảng chăm sóc khách hàng đa kênh và AI cho doanh nghiệp.',
                aiModel: MODEL_ALIAS,
                mainTask: 'customer_care',
                conversationStyle: 'friendly',
                messageLength: 'medium',
                customGreeting: 'Chào bạn, mình có thể hỗ trợ thông tin gì về NemarkChat hôm nay?',
                channels: { website: { enabled: true } },
                isActive: true,
                isDraft: false,
            },
        });
    }

    return { workspaceId, created, updated, total: DEFAULT_KNOWLEDGE.length };
}

const workspaceId = process.argv[2];
if (!workspaceId) {
    console.error('Cách dùng: npm run ai:bootstrap-workspace -- <workspaceId>');
    process.exitCode = 1;
} else {
    bootstrapWorkspace(workspaceId)
        .then((result) => console.log(JSON.stringify(result, null, 2)))
        .catch((error) => {
            console.error(error instanceof Error ? error.message : error);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
