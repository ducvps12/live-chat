import Link from 'next/link';

export default function DemoTargetAudienceSection() {
    const fitCriteria = [
        'Là doanh nghiệp B2B/B2C có team Sales/Support từ 5 người trở lên.',
        'Cần tích hợp sâu Live Chat vào CRM hoặc hệ thống nội bộ.',
        'Muốn kiểm soát dữ liệu chặt chẽ (Audit logs, Role-based access).',
        'Đang tìm giải pháp thay thế Intercom/Zendesk với chi phí tối ưu hơn.',
    ];

    const alternatives = [
        {
            icon: 'play_arrow',
            title: 'Xem demo tự động',
            subtitle: 'Video tương tác 60 giây',
            href: '/demo/video',
        },
        {
            icon: 'rocket_launch',
            title: 'Dùng thử miễn phí',
            subtitle: '14 ngày full tính năng',
            href: '/auth/register',
        },
    ];

    return (
        <section className="py-20 px-6 relative z-10 bg-white">
            <div className="max-w-[1000px] mx-auto grid md:grid-cols-2 gap-8">
                {/* Left: Fit Criteria */}
                <div className="glass-panel p-8 rounded-2xl border-t-2 border-t-electric-blue bg-white shadow-md">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-900">
                        <span className="material-symbols-outlined text-electric-blue">verified</span>
                        Phù hợp nếu bạn:
                    </h3>
                    <ul className="space-y-4">
                        {fitCriteria.map((criterion, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-gray-400 text-sm mt-0.5">check</span>
                                <span className="text-sm text-gray-700">{criterion}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right: Quick Alternatives */}
                <div className="glass-panel p-8 rounded-2xl border-dashed border border-gray-300 bg-gray-50 shadow-sm">
                    <h3 className="text-xl font-bold mb-2 text-gray-900">Nếu bạn chỉ muốn xem nhanh?</h3>
                    <p className="text-sm text-gray-600 mb-8">Không cần chờ đợi. Tự trải nghiệm sản phẩm ngay lập tức.</p>
                    <div className="space-y-4">
                        {alternatives.map((alt, index) => (
                            <Link key={index} href={alt.href}>
                                <div className="flex items-center justify-between p-4 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 hover:border-electric-blue transition-all group cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="size-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 group-hover:bg-electric-blue/10 group-hover:text-electric-blue transition-colors">
                                            <span className="material-symbols-outlined text-lg">{alt.icon}</span>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-gray-900">{alt.title}</div>
                                            <div className="text-xs text-gray-500">{alt.subtitle}</div>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-400 group-hover:text-electric-blue transition-colors">
                                        chevron_right
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
