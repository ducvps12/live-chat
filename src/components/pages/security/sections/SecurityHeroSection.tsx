import Link from 'next/link';

export default function SecurityHeroSection() {
    const features = [
        { icon: 'security', label: 'RBAC theo role & scope' },
        { icon: 'history', label: 'Audit log nhạy cảm' },
        { icon: 'domain', label: 'Multi-tenant Isolation' },
        { icon: 'timelapse', label: 'Retention tùy chỉnh' },
        { icon: 'download', label: 'Export có kiểm soát' },
        { icon: 'fingerprint', label: 'Webhooks Signature' },
        { icon: 'description', label: 'Hỗ trợ DPA' },
        { icon: 'monitor_heart', label: 'Status Page' },
    ];

    return (
        <section className="max-w-7xl mx-auto px-6 pt-32 pb-24 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-electric-blue/30 bg-electric-blue/5 text-electric-blue mb-8">
                <span className="material-symbols-outlined text-base">verified_user</span>
                <span className="text-xs font-bold uppercase tracking-wider">Security Overview</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight max-w-5xl mx-auto">
                Bảo mật và kiểm soát dữ liệu—
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-electric-purple to-electric-teal">
                    cho vận hành SaaS Enterprise.
                </span>
            </h1>

            {/* Description */}
            <p className="text-lg text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                Nemark Inbox được xây dựng với triết lý bảo mật từ thiết kế (Security by Design). Chúng tôi cung cấp khả năng
                kiểm soát truy cập chi tiết, mã hóa đầu cuối và tuân thủ các tiêu chuẩn quốc tế để bảo vệ dữ liệu khách hàng
                của bạn.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Link href="/demo/request">
                    <button className="h-12 px-8 rounded-full bg-electric-blue hover:shadow-[0_0_30px_rgba(13,166,242,0.4)] text-white font-bold text-base transition-all active:scale-95">
                        Yêu cầu demo (Security/Q&A)
                    </button>
                </Link>
                <button className="h-12 px-8 rounded-full bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-base transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">policy</span>
                    Xem DPA/Privacy
                </button>
            </div>

            {/* Feature Chips */}
            <div className="glass-panel rounded-2xl p-6 max-w-5xl mx-auto bg-white shadow-lg">
                <div className="flex flex-wrap justify-center gap-3">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="px-4 py-2 rounded-lg flex items-center gap-2 bg-gradient-to-r from-electric-blue/10 to-electric-purple/10 border border-gray-200"
                        >
                            <span className="material-symbols-outlined text-electric-blue text-sm">{feature.icon}</span>
                            <span className="text-sm text-gray-900 font-medium">{feature.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
