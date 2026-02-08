export default function CaseLibrarySection() {
    const cases = [
        {
            id: 1,
            company: 'PetCare Shop',
            icon: 'pets',
            industry: 'Retail',
            teamSize: '1-5 Agents',
            tags: ['Tư vấn', 'Zalo OA'],
            headline: '"Quản lý inbox Zalo và Web chung một chỗ, không còn lo sót tin nhắn."',
            metrics: ['+25% Conversion', '0% Missed'],
            stack: 'Zalo + Widget',
        },
        {
            id: 2,
            company: 'Lotus Spa',
            icon: 'spa',
            industry: 'Dịch vụ',
            teamSize: '6-20 Agents',
            tags: ['Đặt lịch', 'CSKH'],
            headline: '"Tự động nhắc lịch hẹn cho khách, giảm 50% khách quên lịch (no-show)."',
            metrics: ['-50% No-show', 'Auto Reminder'],
            stack: 'CRM Lite',
        },
        {
            id: 3,
            company: 'Bold Studio',
            icon: 'design_services',
            industry: 'Agency',
            teamSize: '1-5 Agents',
            tags: ['B2B Sales'],
            headline: '"Phân loại lead B2B ngay từ chat đầu tiên, team sales tập trung vào deal lớn."',
            metrics: ['High Quality Lead'],
            stack: 'Tags + Filter',
        },
        {
            id: 4,
            company: 'FastShip',
            icon: 'local_shipping',
            industry: 'Logistics',
            teamSize: '50+ Agents',
            tags: ['Support'],
            headline: '"Tra cứu vận đơn tự động ngay trong khung chat, giảm tải 70% ticket hỗ trợ."',
            metrics: ['-70% Tickets', 'Auto Reply'],
            stack: 'Chatbot API',
        },
        {
            id: 5,
            company: 'FitLife Gym',
            icon: 'fitness_center',
            industry: 'Health',
            teamSize: '20+ Agents',
            tags: ['Membership'],
            headline: '"Gia hạn thẻ tập qua chat nhanh chóng, tăng tỷ lệ retention lên 15%."',
            metrics: ['+15% Retention'],
            stack: 'Inbox',
        },
        {
            id: 6,
            company: 'DevTool.io',
            icon: 'laptop_mac',
            industry: 'SaaS',
            teamSize: '6-20 Agents',
            tags: ['Technical Support'],
            headline: '"Support L1 tự động, team Dev chỉ cần xử lý các vấn đề chuyên sâu."',
            metrics: ['Dev Happy', 'Faster Fix'],
            stack: 'Round-robin',
        },
    ];

    return (
        <section className="py-20 px-6 relative z-10 bg-white">
            <div className="max-w-[1280px] mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-bold text-gray-900">Thư viện Case Study</h2>
                    <div className="relative group">
                        <button className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-gray-900 bg-white border border-gray-300 px-4 py-2 rounded-lg transition-colors hover:border-electric-blue">
                            <span className="material-symbols-outlined text-lg">sort</span>
                            Mới nhất
                        </button>
                    </div>
                </div>

                {/* Case Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cases.map((caseItem) => (
                        <div
                            key={caseItem.id}
                            className="glass-panel p-6 rounded-2xl group cursor-pointer flex flex-col h-full hover:-translate-y-1 transition-all duration-300 bg-white"
                        >
                            {/* Company header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded bg-gradient-to-br from-electric-blue to-electric-purple flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white text-lg">{caseItem.icon}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm">{caseItem.company}</h3>
                                        <p className="text-[10px] text-gray-500">
                                            {caseItem.industry} • {caseItem.teamSize}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {caseItem.tags.map((tag, idx) => (
                                    <span key={idx} className="px-2 py-0.5 rounded-full bg-electric-blue/10 border border-electric-blue/30 text-[10px] text-electric-blue">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* Headline */}
                            <h4 className="font-bold text-lg mb-4 flex-grow text-gray-800">{caseItem.headline}</h4>

                            {/* Metrics */}
                            <div className="flex gap-3 mb-4 text-xs font-mono flex-wrap">
                                {caseItem.metrics.map((metric, idx) => (
                                    <span key={idx} className="bg-electric-blue/10 text-electric-blue px-2 py-1 rounded border border-electric-blue/30">
                                        {metric}
                                    </span>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-[10px] text-gray-500 font-mono">STACK: {caseItem.stack}</span>
                                <span className="text-xs font-bold text-gray-700 group-hover:text-electric-blue transition-colors flex items-center gap-1">
                                    Đọc case <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Load More */}
                <div className="mt-12 text-center">
                    <button className="px-6 py-3 rounded-full border border-gray-300 hover:bg-gray-50 hover:border-electric-blue text-sm font-bold text-gray-700 transition-colors">
                        Xem thêm case study
                    </button>
                </div>
            </div>
        </section>
    );
}
