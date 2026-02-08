import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Card, Input, Tag } from 'antd';
import type { NextPageWithLayout } from '../_app';
import PublicLayout from '@/components/layout/PublicLayout';
import SeoHead from '@/components/common/SeoHead';

const DocsPage: NextPageWithLayout = () => {
    const { t } = useTranslation();

    const categories = [
        {
            title: 'Bắt đầu',
            icon: 'rocket_launch',
            color: 'from-blue-500 to-blue-600',
            articles: [
                { title: 'Giới thiệu về NemarklInbox', slug: 'introduction' },
                { title: 'Đăng ký tài khoản', slug: 'signup' },
                { title: 'Tạo workspace đầu tiên', slug: 'create-workspace' },
                { title: 'Mời thành viên', slug: 'invite-members' },
            ]
        },
        {
            title: 'Tích hợp Widget',
            icon: 'code',
            color: 'from-green-500 to-green-600',
            articles: [
                { title: 'Cài đặt widget lên website', slug: 'install-widget' },
                { title: 'Tùy chỉnh giao diện widget', slug: 'customize-widget' },
                { title: 'Widget cho WordPress', slug: 'wordpress-widget' },
                { title: 'Widget cho Shopify', slug: 'shopify-widget' },
            ]
        },
        {
            title: 'Tích hợp kênh',
            icon: 'hub',
            color: 'from-purple-500 to-purple-600',
            articles: [
                { title: 'Kết nối Facebook Messenger', slug: 'facebook-integration' },
                { title: 'Kết nối Zalo OA', slug: 'zalo-integration' },
                { title: 'Cấu hình Email', slug: 'email-integration' },
                { title: 'Instagram DM', slug: 'instagram-integration' },
            ]
        },
        {
            title: 'Chatbot AI',
            icon: 'smart_toy',
            color: 'from-orange-500 to-orange-600',
            articles: [
                { title: 'Thiết lập Chatbot AI', slug: 'setup-chatbot' },
                { title: 'Kết nối OpenAI API', slug: 'openai-api' },
                { title: 'Train chatbot với dữ liệu riêng', slug: 'train-chatbot' },
                { title: 'Quản lý hội thoại tự động', slug: 'auto-conversation' },
            ]
        },
        {
            title: 'Inbox & Hội thoại',
            icon: 'inbox',
            color: 'from-pink-500 to-pink-600',
            articles: [
                { title: 'Sử dụng Inbox', slug: 'using-inbox' },
                { title: 'Phân công hội thoại', slug: 'assign-conversation' },
                { title: 'Gắn nhãn và phân loại', slug: 'labels-tags' },
                { title: 'Mẫu tin nhắn nhanh', slug: 'quick-replies' },
            ]
        },
        {
            title: 'API & Webhook',
            icon: 'api',
            color: 'from-red-500 to-red-600',
            articles: [
                { title: 'API Reference', slug: 'api-reference' },
                { title: 'Authentication', slug: 'api-auth' },
                { title: 'Webhook events', slug: 'webhooks' },
                { title: 'Rate limits', slug: 'rate-limits' },
            ]
        },
    ];

    return (
        <>
            <SeoHead
                title="Tài liệu - Nemark Inbox"
                description="Tìm hiểu cách sử dụng NemarklInbox hiệu quả nhất"
                canonical="https://nemark.com/docs"
            />

            {/* Hero */}
            <section className="pt-32 pb-12 bg-gradient-to-b from-blue-50/50 to-white">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Trung tâm <span className="text-electric-blue">Tài liệu</span>
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Tìm hiểu cách sử dụng NemarklInbox hiệu quả nhất
                    </p>
                    <div className="max-w-xl mx-auto">
                        <Input
                            size="large"
                            placeholder="Tìm kiếm tài liệu..."
                            prefix={<span className="material-symbols-outlined text-gray-400">search</span>}
                            className="rounded-full"
                        />
                    </div>
                </div>
            </section>

            {/* Quick Links */}
            <section className="py-6 border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2">
                        <Tag color="blue" className="px-4 py-1 cursor-pointer">Bắt đầu</Tag>
                        <Tag className="px-4 py-1 cursor-pointer">Widget</Tag>
                        <Tag className="px-4 py-1 cursor-pointer">Facebook</Tag>
                        <Tag className="px-4 py-1 cursor-pointer">Chatbot</Tag>
                        <Tag className="px-4 py-1 cursor-pointer">API</Tag>
                        <Tag className="px-4 py-1 cursor-pointer">Troubleshooting</Tag>
                    </div>
                </div>
            </section>

            {/* Categories Grid */}
            <section className="py-16">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.map((category, idx) => (
                            <Card key={idx} className="hover:shadow-lg transition-shadow cursor-pointer border-gray-200">
                                <div className={`w-12 h-12 bg-gradient-to-br ${category.color} rounded-xl flex items-center justify-center mb-4`}>
                                    <span className="material-symbols-outlined text-white text-2xl">{category.icon}</span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{category.title}</h3>
                                <ul className="space-y-2">
                                    {category.articles.map((article, articleIdx) => (
                                        <li key={articleIdx}>
                                            <Link href={`/docs/${article.slug}`} className="text-gray-600 hover:text-electric-blue flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                                                {article.title}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Popular Articles */}
            <section className="py-16 bg-gray-50/50">
                <div className="max-w-4xl mx-auto px-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">Bài viết phổ biến</h2>
                    <div className="space-y-4">
                        {[
                            'Hướng dẫn cài đặt widget lên website chỉ trong 5 phút',
                            'Cách kết nối Fanpage Facebook với NemarklInbox',
                            'Thiết lập Chatbot AI tự động trả lời khách hàng',
                            'Tối ưu hiệu suất hỗ trợ với báo cáo SLA',
                            'Quản lý đội ngũ agent hiệu quả',
                        ].map((article, idx) => (
                            <Link key={idx} href="#" className="block p-4 bg-white rounded-lg hover:shadow-md transition-shadow border border-gray-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-700">{article}</span>
                                    <span className="material-symbols-outlined text-gray-400">arrow_forward</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* Need Help */}
            <section className="py-16">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Cần hỗ trợ thêm?</h2>
                    <p className="text-gray-600 mb-8">
                        Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng giúp đỡ bạn
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <Link href="#" className="px-6 py-3 bg-electric-blue text-white rounded-lg hover:bg-electric-blue/90 transition-colors font-medium">
                            Liên hệ hỗ trợ
                        </Link>
                        <Link href="#" className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-medium">
                            Tham gia cộng đồng
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
};

DocsPage.getLayout = function getLayout(page: ReactElement) {
    return <PublicLayout>{page}</PublicLayout>;
};

export default DocsPage;
