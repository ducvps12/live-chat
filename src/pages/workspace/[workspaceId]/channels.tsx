import { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Spin } from 'antd';
import {
    ArrowRight,
    Globe2,
    Inbox,
    Mail,
    Megaphone,
    MessageSquare,
    Settings2,
    Smartphone,
    type LucideIcon,
} from 'lucide-react';
import AppLayout from '../../../components/layout/AppLayout';

type ChannelCard = {
    key: string;
    title: string;
    category: string;
    description: string;
    configureLabel: string;
    configurePath: string;
    inboxChannel?: 'zalo' | 'facebook' | 'widget';
    icon: LucideIcon;
    color: string;
    softColor: string;
};

const CHANNELS: ChannelCard[] = [
    {
        key: 'zalo',
        title: 'Zalo cá nhân',
        category: 'Kênh nhắn tin',
        description: 'Kết nối và đồng bộ tài khoản Zalo. Hội thoại sau khi đồng bộ được xử lý tại Inbox CSKH.',
        configureLabel: 'Quản lý tài khoản',
        configurePath: '/settings?tab=zalo',
        inboxChannel: 'zalo',
        icon: Smartphone,
        color: '#0068ff',
        softColor: '#eaf3ff',
    },
    {
        key: 'facebook',
        title: 'Facebook',
        category: 'Kênh nhắn tin',
        description: 'Liên kết Fanpage để nhận hội thoại Messenger và phân phối cho đội CSKH trong cùng một hàng đợi.',
        configureLabel: 'Quản lý Fanpage',
        configurePath: '/settings?tab=facebook',
        inboxChannel: 'facebook',
        icon: MessageSquare,
        color: '#1877f2',
        softColor: '#edf5ff',
    },
    {
        key: 'widget',
        title: 'Widget website',
        category: 'Kênh nhắn tin',
        description: 'Thiết kế widget, cấu hình domain và lấy mã nhúng. Tin nhắn website đi thẳng vào Inbox CSKH.',
        configureLabel: 'Cấu hình widget',
        configurePath: '/widgets',
        inboxChannel: 'widget',
        icon: Globe2,
        color: '#0f9f6e',
        softColor: '#eafaf4',
    },
    {
        key: 'email',
        title: 'Email hỗ trợ',
        category: 'Tài khoản tích hợp',
        description: 'Quản lý địa chỉ nhận và gửi email hỗ trợ. Đây là phần cấu hình, không phải một Inbox thứ hai.',
        configureLabel: 'Quản lý email',
        configurePath: '/settings?tab=email',
        icon: Mail,
        color: '#d97706',
        softColor: '#fff7e8',
    },
    {
        key: 'popup',
        title: 'Popup thu lead',
        category: 'Tiện ích website',
        description: 'Tạo popup thu thông tin khách và chuyển dữ liệu về workspace mà không tạo thêm màn hình hội thoại riêng.',
        configureLabel: 'Thiết kế popup',
        configurePath: '/popups',
        icon: Megaphone,
        color: '#7c3aed',
        softColor: '#f4efff',
    },
];

export default function WorkspaceChannelsPage() {
    const router = useRouter();
    const { workspaceId } = router.query;

    useEffect(() => {
        const token = localStorage.getItem('nemark_token');
        if (!token) router.replace('/auth/login');
    }, [router]);

    if (typeof workspaceId !== 'string') {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ent-bg)' }}>
                <Spin size="large" />
            </div>
        );
    }

    const withWorkspace = (path: string) => `/workspace/${workspaceId}${path}`;

    return (
        <AppLayout headerTitle="Kết nối kênh">
            <Head>
                <title>Kết nối kênh | NemarkChat</title>
            </Head>

            <main className="channels-page">
                <section className="channels-hero">
                    <div className="channels-hero-copy">
                        <span className="channels-kicker"><Settings2 size={14} /> Trung tâm cấu hình</span>
                        <h1>Một Inbox để xử lý, một nơi để kết nối kênh</h1>
                        <p>
                            Các mục bên dưới chỉ dùng để kết nối và cấu hình. Toàn bộ hội thoại khách hàng được đọc,
                            phân công và trả lời tại Inbox CSKH.
                        </p>
                    </div>
                    <Link className="channels-primary-action" href={withWorkspace('/inbox')}>
                        <Inbox size={17} />
                        Mở Inbox CSKH
                        <ArrowRight size={16} />
                    </Link>
                </section>

                <section className="channels-summary" aria-label="Nguyên tắc vận hành kênh">
                    <div><strong>01</strong><span>Inbox hợp nhất</span></div>
                    <div><strong>05</strong><span>Loại kết nối</span></div>
                    <div><strong>0</strong><span>Inbox trùng lặp</span></div>
                </section>

                <section>
                    <div className="channels-section-heading">
                        <div>
                            <span>Kết nối & tiện ích</span>
                            <h2>Chọn kênh cần cấu hình</h2>
                        </div>
                        <p>Việc cấu hình kênh không làm thay đổi nơi agent xử lý hội thoại.</p>
                    </div>

                    <div className="channels-grid">
                        {CHANNELS.map((channel) => {
                            const Icon = channel.icon;
                            return (
                                <article className="channel-card" key={channel.key}>
                                    <div className="channel-card-head">
                                        <span
                                            className="channel-card-icon"
                                            style={{ color: channel.color, background: channel.softColor }}
                                        >
                                            <Icon size={20} />
                                        </span>
                                        <span className="channel-card-category">{channel.category}</span>
                                    </div>
                                    <h3>{channel.title}</h3>
                                    <p>{channel.description}</p>
                                    <div className="channel-card-actions">
                                        <Link className="channel-configure-action" href={withWorkspace(channel.configurePath)}>
                                            {channel.configureLabel}
                                            <ArrowRight size={15} />
                                        </Link>
                                        {channel.inboxChannel && (
                                            <Link
                                                className="channel-inbox-action"
                                                href={withWorkspace(`/inbox?channel=${channel.inboxChannel}`)}
                                            >
                                                Xem trong Inbox
                                            </Link>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </main>

            <style jsx global>{`
                .channels-page {
                    max-width: 1440px;
                    margin: 0 auto;
                    padding: 28px;
                    color: var(--ent-text);
                }
                .channels-hero {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 28px;
                    padding: 30px;
                    border: 1px solid #dbe4f0;
                    border-radius: 10px;
                    background:
                        radial-gradient(circle at 90% 0%, rgba(37, 99, 235, 0.13), transparent 34%),
                        linear-gradient(135deg, #ffffff 0%, #f6f9ff 100%);
                    box-shadow: 0 12px 36px rgba(15, 23, 42, 0.06);
                }
                .channels-hero-copy { max-width: 760px; }
                .channels-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    color: #2563eb;
                    font-size: 12px;
                    font-weight: 850;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .channels-hero h1 {
                    margin: 12px 0 10px;
                    max-width: 720px;
                    color: #0f172a;
                    font-size: clamp(27px, 3vw, 40px);
                    line-height: 1.12;
                    letter-spacing: -0.035em;
                }
                .channels-hero p {
                    margin: 0;
                    max-width: 720px;
                    color: #5e6b82;
                    font-size: 14px;
                    line-height: 1.75;
                }
                .channels-primary-action,
                .channel-configure-action {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 9px;
                    min-height: 42px;
                    border-radius: 6px;
                    text-decoration: none;
                    font-size: 13px;
                    font-weight: 800;
                    transition: transform 150ms ease, background 150ms ease, border-color 150ms ease;
                }
                .channels-primary-action {
                    flex-shrink: 0;
                    padding: 0 16px;
                    color: #fff;
                    background: #2563eb;
                    border: 1px solid #2563eb;
                    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
                }
                .channels-primary-action:hover { color: #fff; background: #1d4ed8; transform: translateY(-1px); }
                .channels-summary {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    margin: 16px 0 28px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #fff;
                    overflow: hidden;
                }
                .channels-summary > div {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                    min-height: 62px;
                    padding: 15px 20px;
                    border-right: 1px solid #e8edf4;
                }
                .channels-summary > div:last-child { border-right: 0; }
                .channels-summary strong { color: #0f172a; font-size: 23px; }
                .channels-summary span { color: #6b778c; font-size: 13px; font-weight: 650; }
                .channels-section-heading {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 24px;
                    margin-bottom: 16px;
                }
                .channels-section-heading span {
                    color: #2563eb;
                    font-size: 11px;
                    font-weight: 850;
                    letter-spacing: 0.09em;
                    text-transform: uppercase;
                }
                .channels-section-heading h2 { margin: 4px 0 0; color: #0f172a; font-size: 21px; }
                .channels-section-heading p { margin: 0; color: #748096; font-size: 13px; }
                .channels-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                }
                .channel-card {
                    display: flex;
                    min-height: 278px;
                    flex-direction: column;
                    padding: 22px;
                    border: 1px solid #dfe6ef;
                    border-radius: 10px;
                    background: #fff;
                    box-shadow: 0 7px 22px rgba(15, 23, 42, 0.045);
                    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
                }
                .channel-card:hover {
                    transform: translateY(-2px);
                    border-color: #b8c8de;
                    box-shadow: 0 13px 28px rgba(15, 23, 42, 0.075);
                }
                .channel-card-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
                .channel-card-icon {
                    display: grid;
                    width: 42px;
                    height: 42px;
                    place-items: center;
                    border-radius: 8px;
                }
                .channel-card-category {
                    color: #8390a5;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .channel-card h3 { margin: 18px 0 8px; color: #111827; font-size: 18px; }
                .channel-card > p { margin: 0; color: #667085; font-size: 13px; line-height: 1.68; }
                .channel-card-actions {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: auto;
                    padding-top: 22px;
                }
                .channel-configure-action {
                    padding: 0 13px;
                    color: #172033;
                    border: 1px solid #cfd8e6;
                    background: #fff;
                }
                .channel-configure-action:hover { color: #1d4ed8; border-color: #93b4ef; background: #f7faff; }
                .channel-inbox-action {
                    color: #2563eb;
                    font-size: 12px;
                    font-weight: 750;
                    text-decoration: none;
                }
                .channel-inbox-action:hover { color: #1d4ed8; text-decoration: underline; }
                @media (max-width: 1080px) {
                    .channels-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 720px) {
                    .channels-page { padding: 16px; }
                    .channels-hero { align-items: stretch; flex-direction: column; padding: 22px; }
                    .channels-primary-action { align-self: flex-start; }
                    .channels-summary { grid-template-columns: 1fr; }
                    .channels-summary > div { border-right: 0; border-bottom: 1px solid #e8edf4; }
                    .channels-summary > div:last-child { border-bottom: 0; }
                    .channels-section-heading { align-items: flex-start; flex-direction: column; gap: 7px; }
                    .channels-grid { grid-template-columns: 1fr; }
                    .channel-card { min-height: 250px; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .channels-primary-action,
                    .channel-configure-action,
                    .channel-card { transition: none; }
                }
            `}</style>
        </AppLayout>
    );
}
