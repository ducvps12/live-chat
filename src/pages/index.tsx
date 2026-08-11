import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
    ArrowRight,
    BarChart3,
    Bot,
    Building2,
    Check,
    ChevronDown,
    Clock,
    Database,
    FileText,
    Globe2,
    Headphones,
    HelpCircle,
    Layers,
    Lock,
    Mail,
    MessageCircle,
    MessageSquare,
    Menu,
    Radio,
    Shield,
    ShieldCheck,
    Smartphone,
    Sparkles,
    UserCheck,
    Users,
    Webhook,
    X,
    Zap,
} from 'lucide-react';
import { WIDGET_LOADER_PATH } from '../config/widgetLoader';
import { LandingGuidedSetup } from '../features/marketing/LandingGuidedSetup';

const LANDING_WIDGET_ID = process.env.NEXT_PUBLIC_LANDING_WIDGET_ID || 'cmr6lsujd00071sv6xl02s7dr';
const configuredLandingApiBase = process.env.NEXT_PUBLIC_LANDING_WIDGET_API_BASE
    || process.env.NEXT_PUBLIC_API_URL
    || '';
const LANDING_WIDGET_API_BASE = configuredLandingApiBase
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');

const navItems = [
    { label: 'Sản phẩm', href: '#platform' },
    { label: 'AI & Tự động hóa', href: '#automation' },
    { label: 'Giải pháp', href: '#solutions' },
    { label: 'Tích hợp', href: '#channels' },
    { label: 'Bảng giá', href: '#pricing' },
    { label: 'Bảo mật', href: '#security' },
];

const channels = [
    { label: 'Website', icon: Globe2, desc: 'Widget chat gắn trực tiếp trên website bán hàng và portal.' },
    { label: 'Zalo cá nhân', icon: Smartphone, desc: 'Tự động gom hội thoại Zalo về cùng một workspace.' },
    { label: 'Facebook', icon: MessageCircle, desc: 'Tập trung inbox fanpage, ảnh đính kèm và thông tin tin nhắn.' },
    { label: 'Email', icon: Mail, desc: 'Quản lý email CSKH như luồng hội thoại có SLA và phân công.' },
    { label: 'API / Webhook', icon: Webhook, desc: 'Tích hợp dữ liệu với CRM, ERP và hệ thống nội bộ.' },
];

const painPoints = [
    {
        num: '01',
        title: 'Tin nhắn nằm rải rác ở quá nhiều tab',
        desc: 'Đội ngũ phải liên tục chuyển giữa Zalo, Facebook, Email và Livechat website, dẫn đến bỏ sót tin nhắn và xử lý chậm trễ.',
    },
    {
        num: '02',
        title: 'Không rõ agent nào đang phụ trách khách hàng',
        desc: 'Thiếu cơ chế routing tự động khiến các câu hỏi bị trùng lặp câu trả lời hoặc trôi vào quên lãng khi ca trực thay đổi.',
    },
    {
        num: '03',
        title: 'Quản lý chỉ phát hiện khi sự cố đã xảy ra',
        desc: 'Không có chỉ số SLA theo thời gian thực để cảnh báo các hội thoại sắp quá hạn phản hồi trước khi khách hàng phàn nàn.',
    },
];

const workflowSteps = [
    { num: 1, title: 'Khách nhắn tin', desc: 'Gửi từ Website, Zalo, Facebook hoặc Email.' },
    { num: 2, title: 'Inbox hợp nhất', desc: 'Tự động đưa vào hàng đợi chung của workspace.' },
    { num: 3, title: 'Phân công tự động', desc: 'Routing theo ca trực, nhóm chuyên trách hoặc SLA.' },
    { num: 4, title: 'AI tra cứu KB', desc: 'Đọc tri thức nội bộ và gợi ý câu trả lời chuẩn xác.' },
    { num: 5, title: 'Agent kiểm tra & gửi', desc: 'Agent duyệt nhanh câu trả lời trước khi gửi cho khách.' },
    { num: 6, title: 'Lưu log & Báo cáo', desc: 'Ghi nhận tốc độ phản hồi và theo dõi chỉ số SLA.' },
];

const plans = [
    {
        name: 'Khởi đầu',
        monthlyPrice: 299000,
        yearlyPrice: 249000,
        desc: 'Dành cho đội CSKH nhỏ cần gom kênh, tự động hóa và bắt đầu dùng AI.',
        features: [
            '3 agent và 500 hội thoại/tháng',
            '500 lượt AI auto-reply/tháng',
            'Website, Zalo cá nhân & trả lời nhanh',
            'Bỏ thương hiệu và tùy chỉnh widget',
            'Public AI API: 1 ứng dụng, 1.000 lượt/tháng',
            'Radar: 10 nguồn và cảnh báo Telegram riêng',
        ],
        highlighted: false,
    },
    {
        name: 'Chuyên nghiệp',
        monthlyPrice: 799000,
        yearlyPrice: 666000,
        desc: 'Dành cho doanh nghiệp nhiều kênh cần AI, phân tích và tự động hóa ở quy mô lớn.',
        features: [
            '10 agent, hội thoại & AI không giới hạn',
            'White-label và tự code CSS widget',
            'Analytics, đồng bộ lịch sử Zalo & xuất CSV',
            'Public AI API: 3 ứng dụng, 5.000 lượt/tháng',
            'Radar: 50 nguồn, kiểm tra mỗi giờ',
            'Email Campaign và tự động hóa đa kênh',
        ],
        highlighted: true,
    },
    {
        name: 'Enterprise',
        monthlyPrice: null,
        yearlyPrice: null,
        desc: 'Dành cho tổ chức có nhiều thương hiệu, nhu cầu bảo mật và tích hợp sâu.',
        features: [
            'Không giới hạn agent và nhiều workspace',
            'AI Gateway riêng, SLA và mô hình theo yêu cầu',
            'Public AI API: 10 ứng dụng, 25.000 lượt/tháng',
            'Radar: 250 nguồn, kiểm tra mỗi 15 phút',
            'Tích hợp riêng, white-label và hỗ trợ ưu tiên',
        ],
        highlighted: false,
    },
];

const faqItems = [
    {
        q: 'AI có tự trả lời khách hay chỉ gợi ý cho agent?',
        a: 'Bạn có thể chọn theo từng kênh và từng thời điểm. NemarkChat hỗ trợ cả chế độ AI tự trả lời dựa trên Knowledge Base lẫn chế độ chỉ soạn gợi ý để agent duyệt. Khi khách cần xử lý ngoại lệ hoặc yêu cầu người thật, agent có thể tiếp quản ngay và AI sẽ tạm dừng.',
    },
    {
        q: 'Chúng tôi có thể phân chia dữ liệu cho các chi nhánh hoặc phòng ban riêng không?',
        a: 'Có. NemarkChat hỗ trợ mô hình Workspace hoàn toàn tách biệt. Mỗi thương hiệu, chi nhánh hoặc nhóm tư vấn sẽ có môi trường làm việc, danh mục kênh, tri thức và phân quyền truy cập riêng.',
    },
    {
        q: 'NemarkChat hỗ trợ gom những kênh tin nhắn nào?',
        a: 'Hiện tại hệ thống hỗ trợ tích hợp chính thức Live Chat trên Website, Zalo cá nhân / Zalo OA, Facebook Fanpage Messenger, Email CSKH và API/Webhook kết nối mở.',
    },
    {
        q: 'Doanh nghiệp mất bao lâu để bắt đầu triển khai?',
        a: 'Thời gian thiết lập trung bình từ 15 đến 30 phút. Bạn chỉ cần gắn mã widget lên website hoặc kết nối kênh, tải tài liệu FAQ vào Knowledge Base và mời nhân sự vào làm việc.',
    },
    {
        q: 'Tính năng theo dõi SLA thời gian thực hoạt động như thế nào?',
        a: 'Quản trị viên có thể thiết lập thời gian phản hồi tối đa cho từng loại hội thoại hoặc nhóm khách hàng. Khi một hội thoại sắp hoặc đã vượt quá ngưỡng thời gian quy định, hệ thống sẽ bật cảnh báo thị giác lập tức trên dashboard.',
    },
    {
        q: 'Có thể dùng AI của NemarkChat cho website, Telegram hoặc ứng dụng riêng không?',
        a: 'Có. Mỗi workspace có thể tạo khóa Public AI API tương thích chuẩn chat completion, giới hạn theo gói và theo ứng dụng. Bạn có thể dùng cùng tri thức doanh nghiệp để xây chatbot Telegram, trợ lý nội bộ hoặc luồng tự động hóa riêng mà không phải mở quyền quản trị workspace.',
    },
    {
        q: 'Nếu máy AI riêng tạm tắt thì khách hàng có bị mất phản hồi không?',
        a: 'NemarkChat hỗ trợ kiến trúc gateway và nhà cung cấp dự phòng. Khi được cấu hình, yêu cầu sẽ đi qua gateway 24/7 và tự chuyển sang mô hình cloud dự phòng nếu máy AI riêng không sẵn sàng, giúp kênh CSKH tiếp tục hoạt động.',
    },
];

/**
 * Scroll-reveal: adds 'nk-visible' class when elements with 'nk-appear' enter viewport.
 */
function useScrollReveal() {
    const observed = useRef(new Set<Element>());

    const init = useCallback(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('nk-visible');
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12 },
        );

        document
            .querySelectorAll('.nk-appear, .nk-appear-left, .nk-appear-right, .nk-appear-scale')
            .forEach((el) => {
                if (!observed.current.has(el)) {
                    observed.current.add(el);
                    io.observe(el);
                }
            });

        return () => io.disconnect();
    }, []);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            init();
        });
        return () => cancelAnimationFrame(raf);
    }, [init]);
}

export default function HomePage() {
    const [isYearly, setIsYearly] = useState(true);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useScrollReveal();

    useEffect(() => {
        if (!mobileMenuOpen) return undefined;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [mobileMenuOpen]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
    };

    return (
        <>
            <Head>
                <title>NemarkChat | CSKH đa kênh, AI và tự động hóa cho doanh nghiệp</title>
                <meta
                    name="description"
                    content="NemarkChat gom Website, Zalo, Facebook và Email vào một inbox; kết hợp AI CSKH, Public API, Email Campaign và Radar tín hiệu trong một workspace."
                />
                <meta name="keywords" content="CSKH đa kênh, NemarkChat, live chat zalo, quản lý inbox facebook, omni-channel customer support, phần mềm cskh" />
                <meta property="og:title" content="NemarkChat | Phần mềm CSKH đa kênh chuyên nghiệp" />
                <meta property="og:description" content="Một inbox, SLA realtime, AI theo tri thức doanh nghiệp, Public API, Email Campaign và Radar tín hiệu." />
                <meta property="og:type" content="website" />
                <meta property="og:image" content="https://nemarkchat.com/images/og-landing-v2.png" />
                <meta property="og:image:width" content="1728" />
                <meta property="og:image:height" content="909" />
                <meta property="og:image:alt" content="NemarkChat — Không bỏ sót một tin nhắn đa kênh" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:image" content="https://nemarkchat.com/images/og-landing-v2.png" />
                <link rel="icon" href="/images/favicon.png" type="image/png" />
                <link rel="canonical" href="https://nemarkchat.com/" />
            </Head>

            <div className="nk-landing">
                {/* SECTION 1 — HEADER */}
                <header className="nk-nav-header" id="main-header">
                    <div className="nk-container nk-nav-inner">
                        <Link href="/" className="nk-nav-brand" aria-label="Trang chủ NemarkChat">
                            <Image src="/images/logo.png" alt="NemarkChat logo" width={32} height={32} priority />
                            <strong>Nemark<span>Chat</span></strong>
                        </Link>

                        <nav className="nk-nav-links" aria-label="Điều hướng trang web">
                            {navItems.map((item) => (
                                <a href={item.href} key={item.href}>{item.label}</a>
                            ))}
                        </nav>

                        <div className="nk-nav-actions">
                            <Link href="/auth/login" className="nk-btn nk-btn-ghost" id="btn-login-nav">
                                Đăng nhập
                            </Link>
                            <Link href="/auth/register" className="nk-btn nk-btn-primary" id="btn-demo-nav">
                                Bắt đầu miễn phí
                                <ArrowRight size={16} />
                            </Link>
                            <button
                                type="button"
                                className="mobile-menu-toggle p-2 text-slate-600 hover:text-slate-900"
                                aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
                                aria-expanded={mobileMenuOpen}
                                aria-controls="mobile-navigation"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Navigation Drawer */}
                    {mobileMenuOpen && (
                        <nav id="mobile-navigation" className="nk-mobile-navigation bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-3">
                            {navItems.map((item) => (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    className="text-slate-700 font-medium py-2 hover:text-blue-600"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {item.label}
                                </a>
                            ))}
                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                                <Link
                                    href="/auth/login"
                                    className="nk-btn nk-btn-secondary text-center w-full"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Đăng nhập
                                </Link>
                                <Link
                                    href="/auth/register"
                                    className="nk-btn nk-btn-primary text-center w-full"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Bắt đầu miễn phí
                                </Link>
                            </div>
                        </nav>
                    )}
                </header>

                {/* SECTION 2 — HERO */}
                <section className="nk-hero hero-enterprise" id="hero">
                    <div className="nk-container nk-hero-grid">
                        <div className="nk-hero-content">
                            <span className="nk-eyebrow">
                                <Sparkles size={15} />
                                Mới · AI CSKH, Public API và Radar tín hiệu
                            </span>
                            <h1 className="nk-hero-title">
                                Chăm sóc khách hàng đa kênh,
                                <span> không còn bỏ sót một tin nhắn</span>
                            </h1>
                            <p className="nk-hero-desc">
                                Gom Website, Zalo, Facebook và Email vào một inbox. NemarkChat tự phân công,
                                theo dõi SLA, giúp AI trả lời theo tri thức doanh nghiệp và mở API cho mọi quy trình riêng.
                            </p>

                            <div className="nk-hero-actions">
                                <Link href="/auth/register" className="nk-btn nk-btn-primary nk-btn-lg" id="btn-hero-demo">
                                    Tạo workspace miễn phí
                                    <ArrowRight size={18} />
                                </Link>
                                <a href="#platform" className="nk-btn nk-btn-secondary nk-btn-lg" id="btn-hero-start">
                                    Xem cách vận hành
                                </a>
                            </div>

                            <p className="nk-hero-microcopy">
                                Không cần thẻ thanh toán <span>•</span> Có sẵn dữ liệu demo <span>•</span> Thiết lập trong 15 phút
                            </p>

                            <div className="nk-hero-proofs">
                                <div className="nk-hero-proof-item">
                                    <strong>4+</strong>
                                    <span>Kênh hội thoại<br />trong một inbox</span>
                                </div>
                                <div className="nk-hero-proof-item">
                                    <strong>Live</strong>
                                    <span>SLA và trạng thái<br />theo thời gian thực</span>
                                </div>
                                <div className="nk-hero-proof-item">
                                    <strong>AI + người</strong>
                                    <span>Tự động trả lời,<br />tiếp quản khi cần</span>
                                </div>
                            </div>
                        </div>

                        {/* Visual mockup of real NemarkChat Unified Inbox */}
                        <div
                            className="nk-product-frame"
                            role="img"
                            aria-label="Mô phỏng inbox NemarkChat hợp nhất hội thoại Zalo, website và gợi ý trả lời cho nhân viên"
                        >
                            {/* Annotations */}
                            <div className="nk-annotation" style={{ top: '15px', right: '15px' }}>
                                <span className="bg-amber-400 w-2 h-2 rounded-full" />
                                <span>SLA đang chạy (03:42)</span>
                            </div>
                            <div className="nk-annotation" style={{ bottom: '25px', right: '20px' }}>
                                <Sparkles size={13} className="text-blue-400" />
                                <span>AI trả lời theo đúng ngữ cảnh</span>
                            </div>

                            <div className="nk-mock-topbar">
                                <div className="nk-mock-dots">
                                    <span className="bg-rose-400" />
                                    <span className="bg-amber-400" />
                                    <span className="bg-emerald-400" />
                                </div>
                                <div className="text-xs font-semibold text-slate-500">
                                    NemarkChat Inbox — Workspace CSKH
                                </div>
                                <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                    <Radio size={11} />
                                    Realtime
                                </div>
                            </div>

                            <div className="nk-mock-body">
                                {/* Sidebar */}
                                <div className="nk-mock-sidebar">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Kênh hội thoại</div>
                                    <div className="nk-mock-nav-item active">
                                        <Layers size={15} />
                                        <span>Tất cả tin nhắn</span>
                                    </div>
                                    <div className="nk-mock-nav-item">
                                        <Smartphone size={15} className="text-emerald-400" />
                                        <span>Zalo cá nhân</span>
                                    </div>
                                    <div className="nk-mock-nav-item">
                                        <MessageCircle size={15} className="text-blue-400" />
                                        <span>Facebook Fanpage</span>
                                    </div>
                                    <div className="nk-mock-nav-item">
                                        <Globe2 size={15} className="text-indigo-400" />
                                        <span>Website Livechat</span>
                                    </div>
                                    <div className="nk-mock-nav-item">
                                        <Mail size={15} className="text-amber-400" />
                                        <span>Email hỗ trợ</span>
                                    </div>
                                </div>

                                {/* Conversation List */}
                                <div className="nk-mock-conv-list">
                                    <div className="p-3 border-b border-slate-200 text-xs font-bold text-slate-600 flex justify-between items-center">
                                        <span>Hàng đợi (4)</span>
                                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">SLA Live</span>
                                    </div>
                                    <div className="nk-mock-live-notice" aria-label="Zalo vừa có tin nhắn mới">
                                        <span className="nk-annotation-dot" />
                                        <span>Zalo vừa có tin nhắn mới</span>
                                        <span className="nk-mock-live-notice-time">vừa xong</span>
                                    </div>
                                    <div className="nk-mock-conv-item active">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-xs text-slate-900">Anh Hoàng (Zalo)</span>
                                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-semibold">SLA 04:12</span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 truncate">Shop còn mẫu áo này màu be size M không?</p>
                                    </div>
                                    <div className="nk-mock-conv-item">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-xs text-slate-800">Chị Thuỷ (Web)</span>
                                            <span className="text-[10px] text-slate-400">2m</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate">Gửi giúp mình bảng báo giá gói Business nhé...</p>
                                    </div>
                                    <div className="nk-mock-conv-item">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-xs text-slate-800">Công ty Minh Phát</span>
                                            <span className="text-[10px] text-slate-400">12m</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate">Email: Yêu cầu hỗ trợ tích hợp API Webhook...</p>
                                    </div>
                                </div>

                                {/* Active Chat Viewport */}
                                <div className="nk-mock-chat-view">
                                    <div className="nk-mock-chat-header">
                                        <div>
                                            <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                                <Smartphone size={13} className="text-emerald-600" />
                                                <span>Anh Hoàng (Zalo cá nhân)</span>
                                            </div>
                                            <div className="text-[11px] text-slate-500">Phụ trách: Agent Mai • Nhóm Miền Bắc</div>
                                        </div>
                                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium">Đang xử lý</span>
                                    </div>

                                    <div className="nk-mock-chat-messages">
                                        <div className="nk-mock-bubble nk-mock-bubble-customer">
                                            Shop ơi, mẫu áo linen màu be còn size M không?
                                        </div>
                                        <div className="nk-mock-bubble nk-mock-bubble-agent">
                                            Còn bạn nha. Bạn cần mình giữ size M đến tối nay luôn không?
                                        </div>

                                        {/* AI Assist Box Draft */}
                                        <div className="nk-mock-ai-box">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 mb-1">
                                                <Sparkles size={13} />
                                                <span>AI Copilot · hiểu lịch sử khách hàng</span>
                                            </div>
                                            <p className="text-xs text-slate-700 leading-relaxed mb-2">
                                                “Mình giữ size M màu be cho bạn đến 20:00 nhé. Bạn nhận tại shop hay cần mình gửi giao hàng?”
                                                <span className="nk-ai-typing-cursor" />
                                            </p>
                                            <div className="flex gap-2" aria-hidden="true">
                                                <span className="text-[11px] bg-blue-600 text-white font-semibold px-2.5 py-1 rounded">
                                                    Duyệt & Gửi tin
                                                </span>
                                                <span className="text-[11px] bg-white border border-slate-300 text-slate-700 font-medium px-2 py-1 rounded">
                                                    Sửa câu trả lời
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 3 — CHANNEL STRIP */}
                <section className="nk-channel-strip nk-appear" id="channels">
                    <div className="nk-container">
                        <p className="nk-channel-kicker">Một nơi làm việc cho mọi kênh khách hàng đang dùng</p>
                        <div className="nk-channel-grid">
                            {channels.map((ch) => {
                                const Icon = ch.icon;
                                return (
                                    <div key={ch.label} className="nk-channel-item">
                                        <div className="nk-channel-item-icon">
                                            <Icon size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-900">{ch.label}</div>
                                            <div className="text-xs text-slate-500 line-clamp-1">{ch.desc}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="nk-value-strip nk-appear" aria-label="Giá trị nổi bật của NemarkChat">
                    <div className="nk-container nk-value-grid">
                        <div className="nk-value-item">
                            <Layers size={20} />
                            <div>
                                <strong>Một hồ sơ xuyên kênh</strong>
                                <span>Không mất lịch sử khi khách đổi từ Web sang Zalo.</span>
                            </div>
                        </div>
                        <div className="nk-value-item">
                            <Clock size={20} />
                            <div>
                                <strong>Biết việc nào cần xử lý trước</strong>
                                <span>SLA đếm ngược và cảnh báo ngay trên hàng đợi.</span>
                            </div>
                        </div>
                        <div className="nk-value-item">
                            <Bot size={20} />
                            <div>
                                <strong>AI nói như đội ngũ của bạn</strong>
                                <span>Bám tri thức, lịch sử và chuyển người thật đúng lúc.</span>
                            </div>
                        </div>
                    </div>
                </section>

                <LandingGuidedSetup />

                {/* AI & AUTOMATION OPERATING LAYER */}
                <section className="nk-section nk-section-alt nk-appear" id="automation">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <Sparkles size={14} />
                                AI và tự động hóa trong cùng workspace
                            </span>
                            <h2 className="nk-title-lg">Không chỉ trả lời chat — biến dữ liệu thành hành động</h2>
                            <p className="nk-subtitle">
                                Dùng chung hồ sơ khách hàng và tri thức doanh nghiệp để chăm sóc, tiếp thị,
                                theo dõi tín hiệu và kết nối các ứng dụng bên ngoài.
                            </p>
                        </div>

                        <div className="nk-automation-grid">
                            {[
                                {
                                    icon: Bot,
                                    tone: 'blue',
                                    title: 'AI CSKH có kiểm soát',
                                    desc: 'Trả lời theo Knowledge Base, lịch sử và giọng thương hiệu; tự chuyển người thật khi thiếu dữ liệu.',
                                    proof: 'Local AI mạnh + cloud fallback 24/7',
                                },
                                {
                                    icon: Mail,
                                    tone: 'violet',
                                    title: 'Email Campaign',
                                    desc: 'Tạo chiến dịch từ tệp khách hàng, theo dõi gửi/mở/click và đưa phản hồi trở lại inbox.',
                                    proof: 'SMTP riêng, phân nhóm và đo hiệu quả',
                                },
                                {
                                    icon: Webhook,
                                    tone: 'emerald',
                                    title: 'Public AI API',
                                    desc: 'Cấp khóa riêng cho website, Telegram, CRM hoặc agent nội bộ với quota theo từng ứng dụng.',
                                    proof: 'API chuẩn, thu hồi khóa và nhật ký sử dụng',
                                },
                                {
                                    icon: Radio,
                                    tone: 'amber',
                                    title: 'Radar tín hiệu',
                                    desc: 'Theo dõi thay đổi website, giá, hồ sơ tuyển dụng hoặc thông báo mới rồi tóm tắt bằng AI.',
                                    proof: 'Cảnh báo Email hoặc Telegram của khách',
                                },
                            ].map((feature) => {
                                const Icon = feature.icon;
                                return (
                                    <article className="nk-automation-card" key={feature.title}>
                                        <div className={`nk-automation-icon ${feature.tone}`}><Icon size={22} /></div>
                                        <h3>{feature.title}</h3>
                                        <p>{feature.desc}</p>
                                        <div className="nk-automation-proof"><Check size={15} /> {feature.proof}</div>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="nk-automation-cta">
                            <div>
                                <strong>Thử bằng dữ liệu doanh nghiệp của bạn</strong>
                                <span>Tạo workspace, nạp FAQ và xem AI trả lời trước khi bật ra kênh thật.</span>
                            </div>
                            <Link href="/auth/register" className="nk-btn nk-btn-primary">
                                Bắt đầu miễn phí <ArrowRight size={17} />
                            </Link>
                        </div>
                    </div>
                </section>

                {/* SECTION 4 — CUSTOMER PAIN */}
                <section className="nk-section nk-appear" id="solutions">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <HelpCircle size={14} />
                                Vấn đề vận hành thực tế
                            </span>
                            <h2 className="nk-title-lg">Khách hàng đang nhắn ở quá nhiều nơi</h2>
                            <p className="nk-subtitle">
                                Khi kênh giao tiếp tăng lên, nếu không có một quy trình và công cụ hợp nhất, chất lượng CSKH sẽ giảm đáng kể.
                            </p>
                        </div>

                        <div className="nk-pain-editorial">
                            {painPoints.map((pain) => (
                                <article key={pain.num} className="nk-pain-card">
                                    <div className="nk-pain-num">{pain.num}</div>
                                    <h3 className="nk-pain-title">{pain.title}</h3>
                                    <p className="nk-pain-desc">{pain.desc}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* SECTION 5 — WORKFLOW */}
                <section className="nk-section nk-section-alt nk-appear" id="workflow">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <Zap size={14} />
                                Quy trình rõ ràng
                            </span>
                            <h2 className="nk-title-lg">
                                Một quy trình xử lý xuyên suốt từ lúc khách nhắn đến khi hoàn tất
                            </h2>
                            <p className="nk-subtitle">
                                Không sót thông tin, không trả lời sai chính sách, mọi hội thoại đều được kiểm soát và ghi nhận.
                            </p>
                        </div>

                        <div className="nk-workflow-grid">
                            {workflowSteps.map((step) => (
                                <div key={step.num} className="nk-workflow-step">
                                    <div className="nk-step-badge">{step.num}</div>
                                    <div className="nk-step-title">{step.title}</div>
                                    <div className="nk-step-desc">{step.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* SECTION 6 — PRODUCT MODULES */}
                <section className="nk-section nk-appear" id="platform">
                    <div className="nk-container">
                        <div className="nk-header-center mb-16">
                            <span className="nk-eyebrow">
                                <Layers size={14} />
                                Tính năng cốt lõi
                            </span>
                            <h2 className="nk-title-lg">Mọi công cụ cần thiết cho đội ngũ CSKH</h2>
                        </div>

                        {/* Module 1 */}
                        <div className="nk-module-block">
                            <div className="nk-module-text">
                                <h3 className="nk-module-title">Inbox hợp nhất</h3>
                                <p className="nk-module-desc">
                                    Xem hội thoại, lịch sử khách hàng, file đính kèm, ghi chú nội bộ và người phụ trách trong một màn hình duy nhất. Không phải chuyển tab hay đăng nhập nhiều tài khoản riêng lẻ.
                                </p>
                                <div className="nk-module-bullets">
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Gom Website, Zalo cá nhân, Fanpage và Email</span>
                                    </div>
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Xem toàn bộ lịch sử tương tác cũ của từng khách hàng</span>
                                    </div>
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Ghi chú nội bộ giữa các agent mà khách không thấy</span>
                                    </div>
                                </div>
                            </div>
                            <div className="nk-module-visual">
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white p-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                                        <span className="font-bold text-sm text-slate-800">Inbox Vận Hành — Chi Nhánh TP.HCM</span>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Workspace #01</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="p-3 bg-blue-50 border-l-4 border-blue-600 rounded">
                                            <div className="text-xs font-bold text-slate-900">Khách hàng: Nguyễn Văn An • Zalo</div>
                                            <div className="text-xs text-slate-600 mt-1">Nội dung: "Cho mình hỏi sản phẩm này có sẵn kho chưa?"</div>
                                            <div className="text-[11px] text-blue-700 mt-2 font-medium">Người phụ trách: Agent Linh • Ghi chú: Khách quen VIP</div>
                                        </div>
                                        <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                                            <div className="text-xs font-bold text-slate-800">Khách hàng: Trần Thị Mai • Facebook</div>
                                            <div className="text-xs text-slate-500 mt-1">Nội dung: "Cảm ơn shop đã giao hàng nhanh..."</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Module 2 */}
                        <div className="nk-module-block reverse">
                            <div className="nk-module-text">
                                <h3 className="nk-module-title">Vận hành đội ngũ có kiểm soát</h3>
                                <p className="nk-module-desc">
                                    Phân công hội thoại tự động, thiết lập quy tắc routing, theo dõi chỉ số SLA, ca trực và phân quyền truy cập theo vai trò.
                                </p>
                                <div className="nk-module-bullets">
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Phân quyền chi tiết (Owner, Manager, Agent)</span>
                                    </div>
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Thiết lập SLA phản hồi đầu tiên và SLA xử lý xong</span>
                                    </div>
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Routing thông minh theo giờ làm việc & ca trực</span>
                                    </div>
                                </div>
                            </div>
                            <div className="nk-module-visual">
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white p-4">
                                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Quy tắc Phân Phối SLA & Routing</div>
                                    <div className="space-y-3">
                                        <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold text-xs text-slate-900">SLA Phản hồi nhanh (Zalo)</div>
                                                <div className="text-[11px] text-slate-500">Ngưỡng: &lt; 5 phút • Nhóm Sales miền Nam</div>
                                            </div>
                                            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Bật</span>
                                        </div>
                                        <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold text-xs text-slate-900">Routing ca tối (Website)</div>
                                                <div className="text-[11px] text-slate-500">22:00 - 08:00 • Phân công Agent Trực Đêm</div>
                                            </div>
                                            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Bật</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Module 3 */}
                        <div className="nk-module-block">
                            <div className="nk-module-text">
                                <h3 className="nk-module-title">AI xử lý việc lặp lại, người thật xử lý việc cần phán đoán</h3>
                                <p className="nk-module-desc">
                                    AI đọc lịch sử hội thoại và tra cứu tài liệu nội bộ để trả lời hoặc soạn bản nháp.
                                    Bạn quyết định kênh nào được tự động hóa và lúc nào cần chuyển sang agent.
                                </p>
                                <div className="nk-module-bullets">
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Hai chế độ: tự trả lời hoặc chờ agent duyệt</span>
                                    </div>
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Bám Knowledge Base, lịch sử và giọng thương hiệu</span>
                                    </div>
                                    <div className="nk-module-bullet">
                                        <Check size={16} />
                                        <span>Tạm dừng AI ngay khi agent tiếp quản hội thoại</span>
                                    </div>
                                </div>
                            </div>
                            <div className="nk-module-visual">
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white p-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 p-2.5 rounded-lg mb-3">
                                        <Bot size={16} />
                                        <span>AI Assistant — Đang đối chiếu Knowledge Base</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs text-slate-700 mb-3">
                                        <span className="font-bold">Nguồn dữ liệu:</span> File <code>Quy_Trinh_Bao_Hanh_2026.pdf</code> (Trang 4)
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <span className="text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded cursor-pointer">
                                            Duyệt & Gửi khách hàng
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 7 — MANAGER VIEW */}
                <section className="nk-section nk-section-alt nk-appear" id="manager">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <BarChart3 size={14} />
                                Giám sát chất lượng
                            </span>
                            <h2 className="nk-title-lg">Biết việc nào đang chậm trước khi khách hàng phàn nàn</h2>
                            <p className="nk-subtitle">
                                Bảng điều khiển quản lý hiển thị bức tranh tổng thể theo thời gian thực về tải công việc và hiệu suất toàn đội.
                            </p>
                        </div>

                        <div className="nk-manager-dashboard">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex justify-between items-center">
                                <span>Dashboard Giám Sát Thời Gian Thực (Demo Operations)</span>
                                <span className="text-emerald-600 flex items-center gap-1 font-mono">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Live Syncing
                                </span>
                            </div>

                            <div className="nk-dash-grid">
                                <div className="nk-dash-card">
                                    <div className="nk-dash-lbl">Hội thoại gần quá SLA</div>
                                    <div className="nk-dash-val text-amber-600">03</div>
                                    <div className="text-xs text-slate-400 mt-1">Cần hỗ trợ gấp</div>
                                </div>
                                <div className="nk-dash-card">
                                    <div className="nk-dash-lbl">Tải trung bình / Agent</div>
                                    <div className="nk-dash-val text-slate-900">14</div>
                                    <div className="text-xs text-slate-400 mt-1">Trong ngưỡng an toàn</div>
                                </div>
                                <div className="nk-dash-card">
                                    <div className="nk-dash-lbl">Hội thoại chưa nhận</div>
                                    <div className="nk-dash-val text-blue-600">01</div>
                                    <div className="text-xs text-slate-400 mt-1">Hàng đợi Zalo</div>
                                </div>
                                <div className="nk-dash-card">
                                    <div className="nk-dash-lbl">Tỷ lệ AI hỗ trợ</div>
                                    <div className="nk-dash-val text-indigo-600">76%</div>
                                    <div className="text-xs text-slate-400 mt-1">Dữ liệu minh họa</div>
                                </div>
                                <div className="nk-dash-card">
                                    <div className="nk-dash-lbl">Tỷ lệ hài lòng (CSAT)</div>
                                    <div className="nk-dash-val text-emerald-600">4.9/5</div>
                                    <div className="text-xs text-slate-400 mt-1">Dữ liệu minh họa</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 8 — SECURITY */}
                <section className="nk-section" id="security">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <Shield size={14} />
                                An toàn dữ liệu
                            </span>
                            <h2 className="nk-title-lg">Kiểm soát dữ liệu khi đội ngũ mở rộng</h2>
                            <p className="nk-subtitle">
                                Đáp ứng tiêu chuẩn bảo mật cho doanh nghiệp nhiều thương hiệu và phòng ban.
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                                <Lock size={24} className="text-blue-600 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-2">Tách biệt Workspace</h3>
                                <p className="text-sm text-slate-600">Dữ liệu từng chi nhánh hay thương hiệu được cô lập hoàn toàn.</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                                <UserCheck size={24} className="text-blue-600 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-2">Phân quyền RBAC</h3>
                                <p className="text-sm text-slate-600">Quyền truy cập chặt chẽ theo vai trò Owner, Manager và Agent.</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                                <FileText size={24} className="text-blue-600 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-2">Audit Logs</h3>
                                <p className="text-sm text-slate-600">Ghi lại nhật ký mọi thao tác phân công và thay đổi cấu hình.</p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                                <Database size={24} className="text-blue-600 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-2">Mã hóa Dữ liệu</h3>
                                <p className="text-sm text-slate-600">Mã hóa dữ liệu khi truyền và khi lưu trữ theo cấu hình của hệ thống.</p>
                            </div>
                        </div>

                        {/* Legal links active */}
                        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600 pt-4 border-t border-slate-100">
                            <Link href="/security" className="hover:text-blue-600 font-medium">Trung tâm Bảo mật (Trust Center)</Link>
                            <span>•</span>
                            <Link href="/privacy" className="hover:text-blue-600 font-medium">Chính sách Quyền riêng tư</Link>
                            <span>•</span>
                            <Link href="/terms" className="hover:text-blue-600 font-medium">Điều khoản Sử dụng</Link>
                            <span>•</span>
                            <Link href="/data-processing" className="hover:text-blue-600 font-medium">Thỏa thuận Xử lý Dữ liệu</Link>
                        </div>
                    </div>
                </section>

                {/* SECTION 9 — IMPLEMENTATION */}
                <section className="nk-section nk-section-alt" id="deployment">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <Clock size={14} />
                                Triển khai nhanh chóng
                            </span>
                            <h2 className="nk-title-lg">
                                Bắt đầu từ các kênh hiện có, không phải làm lại quy trình
                            </h2>
                            <p className="nk-subtitle">
                                5 bước đơn giản để đưa toàn bộ đội ngũ vào vận hành chuyên nghiệp.
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {[
                                { step: '1', title: 'Kết nối kênh', desc: 'Gắn widget web, Zalo, Fanpage & Email' },
                                { step: '2', title: 'Nạp FAQ & tài liệu', desc: 'Tải PDF/Docx vào Knowledge Base' },
                                { step: '3', title: 'Mời đội ngũ', desc: 'Tạo tài khoản và phân nhóm phụ trách' },
                                { step: '4', title: 'Thiết lập SLA', desc: 'Cấu hình quy tắc routing & thời gian' },
                                { step: '5', title: 'Go-live & Theo dõi', desc: 'Vận hành thực tế và xem báo cáo' },
                            ].map((item) => (
                                <div key={item.step} className="bg-white border border-slate-200 p-5 rounded-xl text-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold mx-auto mb-3 flex items-center justify-center text-sm">
                                        {item.step}
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-sm mb-1">{item.title}</h3>
                                    <p className="text-xs text-slate-500">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* SECTION 10 — PRICING */}
                <section className="nk-section nk-appear" id="pricing">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <Building2 size={14} />
                                Bảng giá linh hoạt
                            </span>
                            <h2 className="nk-title-lg">Bảng giá minh bạch, tối ưu theo quy mô đội ngũ</h2>
                            <p className="nk-subtitle">
                                Chọn gói phù hợp với số lượng kênh và nhu cầu kiểm soát của doanh nghiệp.
                            </p>
                        </div>

                        {/* Working Monthly / Yearly Toggle */}
                        <div className="nk-pricing-toggle">
                            <span className={`text-sm font-semibold ${!isYearly ? 'text-slate-900' : 'text-slate-500'}`}>
                                Thanh toán hàng tháng
                            </span>
                            <button
                                type="button"
                                className="nk-toggle-btn"
                                onClick={() => setIsYearly(!isYearly)}
                                aria-label="Chuyển đổi chu kỳ thanh toán"
                                role="switch"
                                aria-checked={isYearly}
                            >
                                <span className={`nk-toggle-opt ${!isYearly ? 'active' : ''}`}>Tháng</span>
                                <span className={`nk-toggle-opt ${isYearly ? 'active' : ''}`}>Năm (Tặng 2 tháng)</span>
                            </button>
                            <span className={`text-sm font-semibold ${isYearly ? 'text-blue-600' : 'text-slate-500'}`}>
                                Thanh toán hàng năm
                            </span>
                        </div>

                        <div className="nk-pricing-grid">
                            {plans.map((plan) => {
                                const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
                                return (
                                    <div
                                        key={plan.name}
                                        className={`nk-price-card ${plan.highlighted ? 'featured' : ''}`}
                                    >
                                        {plan.highlighted && (
                                            <div className="nk-price-badge">Được khuyên dùng</div>
                                        )}
                                        <div className="nk-price-name">{plan.name}</div>
                                        <div className="text-sm text-slate-500 mt-2 min-h-[40px]">{plan.desc}</div>

                                        <div className="nk-price-amount">
                                            {price ? (
                                                <>
                                                    {formatCurrency(price)}
                                                    <span> /tháng{isYearly ? ', trả theo năm' : ''}</span>
                                                </>
                                            ) : (
                                                <span>Liên hệ báo giá</span>
                                            )}
                                        </div>

                                        <div className="my-6 border-t border-slate-100 pt-6 space-y-3 flex-1">
                                            {plan.features.map((feat) => (
                                                <div key={feat} className="flex items-center gap-2.5 text-sm text-slate-700">
                                                    <Check size={16} className="text-blue-600 flex-shrink-0" />
                                                    <span>{feat}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <Link
                                            href="/auth/register"
                                            className={`nk-btn w-full text-center ${plan.highlighted ? 'nk-btn-primary' : 'nk-btn-secondary'}`}
                                        >
                                            Bắt đầu dùng thử
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* SECTION 11 — FAQ */}
                <section className="nk-section nk-section-alt nk-appear" id="faq">
                    <div className="nk-container">
                        <div className="nk-header-center">
                            <span className="nk-eyebrow">
                                <HelpCircle size={14} />
                                Giải đáp thắc mắc
                            </span>
                            <h2 className="nk-title-lg">Câu hỏi thường gặp</h2>
                        </div>

                        <div className="nk-faq-list">
                            {faqItems.map((item, idx) => {
                                const isOpen = openFaqIndex === idx;
                                return (
                                    <div key={item.q} className="nk-faq-item">
                                        <button
                                            type="button"
                                            className="nk-faq-trigger"
                                            onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                            aria-expanded={isOpen}
                                            aria-controls={`faq-content-${idx}`}
                                        >
                                            <span>{item.q}</span>
                                            <ChevronDown
                                                size={18}
                                                className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`}
                                            />
                                        </button>
                                        {isOpen && (
                                            <div id={`faq-content-${idx}`} className="nk-faq-content">
                                                {item.a}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* SECTION 12 — FINAL CTA */}
                <section className="nk-section nk-section-dark text-center nk-appear" id="demo">
                    <div className="nk-container max-width-680">
                        <span className="nk-eyebrow bg-blue-900/60 border-blue-700 text-blue-300">
                            <Sparkles size={14} />
                            Trải nghiệm thực tế
                        </span>
                        <h2 className="nk-title-lg text-white mt-4">
                            Thử AI với chính dữ liệu doanh nghiệp của bạn
                        </h2>
                        <p className="nk-subtitle text-slate-300 max-w-xl mx-auto mt-4 mb-8">
                            Tạo workspace, nạp FAQ và thử phản hồi nội bộ trước khi bật ra kênh thật. Không cần thẻ thanh toán.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Link href="/auth/register" className="nk-btn nk-btn-primary nk-btn-lg">
                                Thử AI miễn phí
                                <ArrowRight size={18} />
                            </Link>
                            <Link href="/auth/register" className="nk-btn nk-btn-secondary nk-btn-lg">
                                Tạo workspace miễn phí
                            </Link>
                        </div>
                    </div>
                </section>

                {/* SECTION 13 — FOOTER */}
                <footer className="nk-footer">
                    <div className="nk-container">
                        <div className="nk-footer-grid">
                            <div>
                                <Link href="/" className="nk-nav-brand text-white mb-4 inline-flex">
                                    <Image src="/images/logo.png" alt="NemarkChat logo" width={28} height={28} />
                                    <strong className="text-white">Nemark<span className="text-blue-400">Chat</span></strong>
                                </Link>
                                <p className="text-sm text-slate-400 max-w-xs mt-3 leading-relaxed">
                                    Nền tảng CSKH đa kênh, AI và tự động hóa dành cho doanh nghiệp Việt Nam.
                                </p>
                            </div>

                            <div className="nk-footer-col">
                                <h3>Sản phẩm</h3>
                                <ul>
                                    <li><a href="#platform">Inbox hợp nhất</a></li>
                                    <li><a href="#channels">Tích hợp Zalo & Fanpage</a></li>
                                    <li><a href="#workflow">AI Knowledge Base</a></li>
                                    <li><a href="#automation">Public API & Radar tín hiệu</a></li>
                                    <li><a href="#manager">Báo cáo SLA</a></li>
                                </ul>
                            </div>

                            <div className="nk-footer-col">
                                <h3>Bảo mật & Pháp lý</h3>
                                <ul>
                                    <li><Link href="/security">Trung tâm Bảo mật</Link></li>
                                    <li><Link href="/privacy">Quyền riêng tư</Link></li>
                                    <li><Link href="/terms">Điều khoản sử dụng</Link></li>
                                    <li><Link href="/data-processing">Xử lý dữ liệu</Link></li>
                                </ul>
                            </div>

                            <div className="nk-footer-col">
                                <h3>Tài nguyên</h3>
                                <ul>
                                    <li><Link href="/help">Trung tâm trợ giúp</Link></li>
                                    <li><Link href="/blog">Bài viết & Khảo sát</Link></li>
                                    <li><Link href="/changelog">Cật nhật phiên bản</Link></li>
                                    <li><Link href="/status">Trạng thái hệ thống</Link></li>
                                </ul>
                            </div>

                            <div className="nk-footer-col">
                                <h3>Liên hệ</h3>
                                <ul>
                                    <li><Link href="/contact">Hỗ trợ kỹ thuật</Link></li>
                                    <li><a href="mailto:support@nemarkchat.vn">support@nemarkchat.vn</a></li>
                                    <li><span className="text-xs text-slate-500">Giờ làm việc: 08:00 - 20:00</span></li>
                                </ul>
                            </div>
                        </div>

                        <div className="nk-footer-bottom">
                            <div>© {new Date().getFullYear()} NemarkChat. Tất cả quyền được bảo lưu.</div>
                            <div className="text-slate-500 text-xs">
                                Thiết kế cho đội CSKH vận hành tại Việt Nam
                            </div>
                        </div>
                    </div>
                </footer>

                {/* Widget loader element */}
                <LandingChatWidget />
            </div>
        </>
    );
}

type LandingWidgetApi = {
    widgetId?: string;
    destroy?: () => void;
};

type LandingWidgetWindow = Window & {
    NemarkChat?: LandingWidgetApi | string;
    __nchat_loaded?: boolean;
    __nchat_destroyed?: boolean;
};

type PublicSupportWidgetConfig = {
    enabled?: boolean;
    widgetId?: string;
    apiBase?: string;
};

function LandingChatWidget() {
    useEffect(() => {
        const widgetWindow = window as LandingWidgetWindow;
        const scriptId = 'nemark-landing-widget-loader';
        let script: HTMLScriptElement | null = null;
        let cancelled = false;
        let activeWidgetId = LANDING_WIDGET_ID;

        const resolveSupportWidget = async () => {
            const base = LANDING_WIDGET_API_BASE || window.location.origin;
            try {
                const res = await fetch(`${base}/api/workspaces/public/system-support-widget`, {
                    cache: 'no-store',
                    credentials: 'omit',
                });
                if (!res.ok) return { widgetId: LANDING_WIDGET_ID, apiBase: LANDING_WIDGET_API_BASE };
                const body = await res.json();
                const data = body?.data as PublicSupportWidgetConfig | undefined;
                if (data?.enabled && data.widgetId) {
                    return {
                        widgetId: data.widgetId,
                        apiBase: data.apiBase || LANDING_WIDGET_API_BASE,
                    };
                }
            } catch {
                // Keep landing resilient: fallback to build-time widget config.
            }
            return { widgetId: LANDING_WIDGET_ID, apiBase: LANDING_WIDGET_API_BASE };
        };

        const injectTimer = window.setTimeout(() => {
            if (cancelled) return;
            void resolveSupportWidget().then(({ widgetId, apiBase }) => {
                if (cancelled || !widgetId) return;
                activeWidgetId = widgetId;
                script = document.getElementById(scriptId) as HTMLScriptElement | null;
                if (!script) {
                    script = document.createElement('script');
                    script.id = scriptId;
                    script.src = WIDGET_LOADER_PATH;
                    script.async = true;
                    script.referrerPolicy = 'strict-origin-when-cross-origin';
                    script.setAttribute('data-widget-id', widgetId);
                    script.setAttribute('data-source', 'landing');
                    if (apiBase) {
                        script.setAttribute('data-api-base', apiBase);
                    }
                    document.head.appendChild(script);
                }
            });
        }, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(injectTimer);
            const api = widgetWindow.NemarkChat;
            if (api && typeof api === 'object' && api.widgetId === activeWidgetId) {
                api.destroy?.();
            }
            script?.remove();

            [
                'nchat-bubble',
                'nchat-window',
                'nchat-tooltip',
                'nchat-greeting',
                'nchat-styles',
                'nchat-fallback-bubble',
                'nchat-fallback-tip',
                'nchat-fallback-styles',
            ].forEach((elementId) => document.getElementById(elementId)?.remove());
            widgetWindow.__nchat_loaded = false;
            widgetWindow.__nchat_destroyed = true;
        };
    }, []);

    return null;
}
