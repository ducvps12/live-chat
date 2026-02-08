export default function DemoBenefitsSection() {
    const benefits = [
        {
            number: 1,
            title: 'Khảo sát Use Case',
            description: 'Tìm hiểu nhanh về mô hình kinh doanh, nỗi đau hiện tại và mục tiêu chuyển đổi của bạn.',
            color: 'blue',
        },
        {
            number: 2,
            title: 'Live Demo Luồng',
            description: 'Trải nghiệm thực tế: Khách vào Widget → Chat đổ về Inbox → Lưu Contact → Xem Report.',
            color: 'purple',
        },
        {
            number: 3,
            title: 'Thiết kế Routing',
            description: 'Tư vấn cách chia chat cho team Sales/Support và thiết lập quyền hạn (RBAC) phù hợp.',
            color: 'teal',
        },
        {
            number: 4,
            title: 'Plan & Báo giá',
            description: 'Đề xuất gói phù hợp nhất và kế hoạch triển khai chi tiết (5-7 ngày) cho đội ngũ của bạn.',
            color: 'gray',
        },
    ];

    const getColorClasses = (color: string) => {
        const colorMap: Record<string, string> = {
            blue: 'bg-electric-blue/10 border-electric-blue/30 text-electric-blue shadow-[0_0_15px_rgba(13,166,242,0.2)]',
            purple: 'bg-electric-purple/10 border-electric-purple/30 text-electric-purple shadow-[0_0_15px_rgba(168,85,247,0.2)]',
            teal: 'bg-electric-teal/10 border-electric-teal/30 text-electric-teal shadow-[0_0_15px_rgba(20,184,166,0.2)]',
            gray: 'bg-gray-100 border-gray-300 text-gray-700',
        };
        return colorMap[color] || colorMap.blue;
    };

    return (
        <section className="py-20 px-6 relative border-t border-gray-200 bg-gray-50">
            <div className="max-w-[1280px] mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h2 className="text-2xl lg:text-3xl font-bold mb-3 text-gray-900">Bạn sẽ nhận được gì trong buổi demo?</h2>
                    <p className="text-sm text-gray-600 flex items-center justify-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-electric-blue text-base">schedule</span> Thời lượng: 20–30 phút
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-green-500 text-base">videocam</span> Online (Google Meet/Zoom)
                        </span>
                        <span className="text-gray-400">•</span>
                        <span>Có Q&A</span>
                    </p>
                </div>

                {/* Benefits Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                    {/* Connecting line (desktop only) */}
                    <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-electric-blue/20 to-transparent -translate-y-1/2 z-0"></div>

                    {benefits.map((benefit) => (
                        <div
                            key={benefit.number}
                            className="glass-panel p-6 rounded-xl bg-white relative z-10 flex flex-col gap-3 group hover:-translate-y-2 transition-all duration-300 shadow-md"
                        >
                            <div className={`size-10 rounded-full border flex items-center justify-center font-bold text-lg mb-2 ${getColorClasses(benefit.color)}`}>
                                {benefit.number}
                            </div>
                            <h3 className="font-bold text-gray-900">{benefit.title}</h3>
                            <p className="text-xs text-gray-600 leading-relaxed">{benefit.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
