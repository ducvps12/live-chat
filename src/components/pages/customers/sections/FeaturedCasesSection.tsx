export default function FeaturedCasesSection() {
    const cases = [
        {
            id: 1,
            company: 'Acme Luxury',
            industry: 'TMĐT',
            teamSize: '20+ Agents',
            icon: 'diamond',
            headline: '"Giảm 40% thời gian phản hồi đầu tiên chỉ trong 2 tuần áp dụng."',
            metrics: [
                { label: '-40% FRT', color: 'green' },
                { label: '+15% AOV', color: 'blue' },
                { label: 'Zero Missed', color: 'gray' },
            ],
            keyChange: 'Áp dụng quy tắc chia hội thoại Round-robin và mẫu câu trả lời nhanh.',
            accentColor: 'blue',
        },
        {
            id: 2,
            company: 'Edutech Pro',
            industry: 'Giáo dục',
            teamSize: '5 Agents',
            icon: 'school',
            headline: '"X3 số lượng lead thu được từ website nhờ kịch bản chào tự động."',
            metrics: [
                { label: '300% Leads', color: 'purple' },
                { label: '24/7 Active', color: 'gray' },
            ],
            keyChange: 'Cài đặt chatbot chào khách dựa trên trang đang xem (Contextual Greeting).',
            accentColor: 'purple',
        },
        {
            id: 3,
            company: 'Homeland',
            industry: 'BĐS',
            teamSize: '50+ Agents',
            icon: 'real_estate_agent',
            headline: '"Minh bạch hóa việc chia khách, team sales không còn tranh chấp."',
            metrics: [
                { label: '100% SLA', color: 'teal' },
                { label: 'Hài lòng cao', color: 'gray' },
            ],
            keyChange: 'Phân luồng chat theo khu vực địa lý và kỹ năng tư vấn viên.',
            accentColor: 'teal',
        },
    ];

    const getMetricClasses = (color: string) => {
        const colorMap: Record<string, string> = {
            green: 'bg-green-100 text-green-700 border-green-300',
            blue: 'bg-electric-blue/10 text-electric-blue border-electric-blue/30',
            purple: 'bg-electric-purple/10 text-electric-purple border-electric-purple/30',
            teal: 'bg-electric-teal/10 text-electric-teal border-electric-teal/30',
            gray: 'bg-gray-100 text-gray-700 border-gray-300',
        };
        return colorMap[color] || colorMap.gray;
    };

    const getBorderColor = (color: string) => {
        const colorMap: Record<string, string> = {
            blue: 'border-electric-blue/50',
            purple: 'border-electric-purple/50',
            teal: 'border-electric-teal/50',
        };
        return colorMap[color] || 'border-electric-blue/50';
    };

    return (
        <section className="py-12 px-6 relative z-10">
            <div className="max-w-[1280px] mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {cases.map((caseStudy, index) => (
                        <div
                            key={caseStudy.id}
                            className="glass-panel p-8 rounded-3xl relative overflow-hidden group flex flex-col h-full hover:-translate-y-1 transition-all duration-300 bg-white"
                        >
                            {/* Decorative blob */}
                            <div className={`absolute inset-0 bg-gradient-to-br from-electric-${caseStudy.accentColor}/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                            {/* Company info */}
                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                <div className="size-10 rounded-lg bg-gradient-to-br from-electric-blue to-electric-purple flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white">{caseStudy.icon}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight text-gray-900">{caseStudy.company}</h3>
                                    <p className="text-xs text-gray-500">
                                        {caseStudy.industry} • {caseStudy.teamSize}
                                    </p>
                                </div>
                            </div>

                            {/* Headline */}
                            <h4 className="text-xl font-bold mb-6 min-h-[56px] text-gray-800 relative z-10">{caseStudy.headline}</h4>

                            {/* Metrics */}
                            <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                                {caseStudy.metrics.map((metric, idx) => (
                                    <span
                                        key={idx}
                                        className={`px-3 py-1 rounded text-sm font-bold border ${getMetricClasses(metric.color)}`}
                                    >
                                        {metric.label}
                                    </span>
                                ))}
                            </div>

                            {/* Progress bar visualization */}
                            <div className="mb-6 relative z-10">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Trước</span>
                                    <span>Sau</span>
                                </div>
                                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
                                    <div className="h-full bg-red-400/70 w-2/3"></div>
                                    <div className="h-full bg-electric-teal w-1/3 shadow-[0_0_10px_rgba(20,184,166,0.3)]"></div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 italic">Tốc độ phản hồi trung bình</p>
                            </div>

                            {/* Key change */}
                            <div className="mt-auto relative z-10">
                                <p className={`text-sm text-gray-600 mb-4 border-l-2 ${getBorderColor(caseStudy.accentColor)} pl-3`}>
                                    <span className="text-gray-900 font-semibold">Thay đổi chính:</span> {caseStudy.keyChange}
                                </p>

                                {/* CTAs */}
                                <div className="flex gap-3">
                                    <button className="flex-1 py-2.5 rounded-lg bg-electric-blue hover:shadow-[0_0_20px_rgba(13,166,242,0.3)] text-white text-sm font-bold transition-all">
                                        Đọc case
                                    </button>
                                    <button
                                        className="px-4 py-2.5 rounded-lg border border-gray-300 hover:border-electric-blue text-gray-600 hover:text-electric-blue transition-colors"
                                        title="Xem playbook"
                                    >
                                        <span className="material-symbols-outlined text-lg">menu_book</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
