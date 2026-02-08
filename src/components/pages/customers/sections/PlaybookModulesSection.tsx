import Link from 'next/link';

export default function PlaybookModulesSection() {
    const modules = [
        {
            id: 1,
            title: 'Thu lead tự nhiên',
            icon: 'work',
            color: 'blue',
            features: ['Chatbot chào khách', 'Form thu thập thông tin', 'Trigger theo hành vi'],
        },
        {
            id: 2,
            title: 'Không bỏ sót',
            icon: 'inbox',
            color: 'purple',
            features: ['Gom tin nhắn đa kênh', 'Thông báo real-time', 'Auto-reply ngoài giờ'],
        },
        {
            id: 3,
            title: 'Phân công minh bạch',
            icon: 'hub',
            color: 'teal',
            features: ['Chia lead Round-robin', 'Gán theo kỹ năng', 'Chuyển hội thoại mượt'],
        },
        {
            id: 4,
            title: 'Quản trị bằng số',
            icon: 'monitoring',
            color: 'gray',
            features: ['Báo cáo thời gian phản hồi', 'Hiệu suất nhân viên', 'Rating & Feedback'],
        },
    ];

    const getColorClasses = (color: string) => {
        const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
            blue: {
                bg: 'bg-electric-blue/10',
                text: 'text-electric-blue',
                icon: 'text-electric-blue',
            },
            purple: {
                bg: 'bg-electric-purple/10',
                text: 'text-electric-purple',
                icon: 'text-electric-purple',
            },
            teal: {
                bg: 'bg-electric-teal/10',
                text: 'text-electric-teal',
                icon: 'text-electric-teal',
            },
            gray: {
                bg: 'bg-gray-100',
                text: 'text-gray-600',
                icon: 'text-gray-600',
            },
        };
        return colorMap[color] || colorMap.blue;
    };

    return (
        <section className="py-24 px-6 relative z-10 bg-white">
            <div className="max-w-[1280px] mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-gray-900">
                        Áp dụng ngay <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-electric-purple">Playbook tăng trưởng</span>
                    </h2>
                    <p className="text-gray-600">Các module tính năng được thiết kế để giải quyết từng bài toán cụ thể.</p>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {modules.map((module) => {
                        const colors = getColorClasses(module.color);
                        return (
                            <div key={module.id} className="glass-panel p-6 rounded-3xl flex flex-col gap-4 group hover:-translate-y-1 transition-all duration-300 bg-white">
                                {/* Icon */}
                                <div className={`size-10 rounded-xl ${colors.bg} flex items-center justify-center ${colors.text} mb-2`}>
                                    <span className="material-symbols-outlined">{module.icon}</span>
                                </div>

                                {/* Title */}
                                <h3 className="text-lg font-bold text-gray-900">{module.title}</h3>

                                {/* Features */}
                                <ul className="space-y-2 mb-4">
                                    {module.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                                            <span className={`material-symbols-outlined ${colors.icon} text-sm`}>check</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {/* Link */}
                                <Link href="#" className={`${colors.text} text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all mt-auto`}>
                                    Xem module <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
