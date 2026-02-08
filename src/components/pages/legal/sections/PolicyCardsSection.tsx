import Link from 'next/link';

export default function PolicyCardsSection() {
    const policies = [
        {
            icon: 'gavel',
            iconColor: 'blue',
            title: 'Điều khoản sử dụng',
            date: '01/01/2024',
            tags: ['USERS', 'BUSINESS'],
            slug: 'terms-of-service',
            features: [
                'Quy định về tài khoản & trách nhiệm',
                'Chính sách thanh toán & hoàn tiền',
                'Điều kiện chấm dứt hợp đồng',
            ],
            important: false,
        },
        {
            icon: 'shield_lock',
            iconColor: 'primary',
            title: 'Chính sách bảo mật',
            date: '15/02/2024',
            tags: ['IMPORTANT'],
            slug: 'privacy-policy',
            features: ['Dữ liệu chúng tôi thu thập', 'Cách chúng tôi sử dụng dữ liệu', 'Quyền riêng tư của bạn (GDPR/CCPA)'],
            important: true,
        },
        {
            icon: 'cookie',
            iconColor: 'orange',
            title: 'Chính sách Cookie',
            date: '01/01/2024',
            tags: ['VISITORS'],
            slug: 'cookie-policy',
            features: ['Các loại cookie được sử dụng', 'Thời gian lưu trữ cookie', 'Hướng dẫn tắt tracking'],
            important: false,
        },
        {
            icon: 'database',
            iconColor: 'green',
            title: 'Chính sách lưu trữ (Retention)',
            date: '01/03/2024',
            tags: ['BUSINESS', 'COMPLIANCE'],
            slug: 'retention-policy',
            features: ['Thời hạn lưu trữ log chat', 'Quy trình sao lưu (Backup)', 'Quy trình xóa vĩnh viễn'],
            important: false,
        },
        {
            icon: 'description',
            iconColor: 'purple',
            title: 'Data Processing Agreement (DPA)',
            date: '01/01/2024',
            tags: ['BUSINESS'],
            slug: 'dpa',
            features: [
                'Cam kết xử lý dữ liệu chuẩn EU',
                'Vai trò Controller vs Processor',
                'Cơ chế chuyển dữ liệu quốc tế',
            ],
            important: false,
        },
        {
            icon: 'hub',
            iconColor: 'pink',
            title: 'Danh sách Sub-processors',
            date: '10/03/2024',
            tags: ['COMPLIANCE', 'DEV'],
            slug: 'sub-processors',
            features: [
                'Đối tác hạ tầng (AWS, Cloudflare...)',
                'Dịch vụ tích hợp bên thứ 3',
                'Đăng ký nhận thông báo thay đổi',
            ],
            important: false,
        },
    ];


    const getIconColorClass = (color: string) => {
        const colorMap: Record<string, string> = {
            blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            primary: 'bg-electric-blue/20 text-electric-blue border-electric-blue/30',
            orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
            green: 'bg-green-500/10 text-green-500 border-green-500/20',
            purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            pink: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
        };
        return colorMap[color] || colorMap.blue;
    };

    return (
        <section className="py-16 px-6 relative z-10">
            <div className="max-w-[1280px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {policies.map((policy, index) => (
                        <div
                            key={index}
                            className={`glass-panel p-6 rounded-2xl flex flex-col group h-full bg-white shadow-md hover:-translate-y-1 transition-all duration-300 ${policy.important ? 'border-electric-blue/30 shadow-electric-blue/10' : 'border-gray-200'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div
                                    className={`size-12 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform ${getIconColorClass(
                                        policy.iconColor
                                    )}`}
                                >
                                    <span className="material-symbols-outlined text-2xl">{policy.icon}</span>
                                </div>
                                <div className="flex gap-2 flex-wrap justify-end">
                                    {policy.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className={`text-[10px] font-bold px-2 py-1 rounded border ${tag === 'IMPORTANT'
                                                ? 'bg-electric-blue/20 border-electric-blue/30 text-electric-blue'
                                                : 'bg-gray-100 border-gray-300 text-gray-600'
                                                }`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{policy.title}</h3>
                            <p className="text-xs text-gray-500 mb-4 font-mono">Last updated: {policy.date}</p>
                            <div className="space-y-3 mb-6 flex-grow">
                                <div className="h-px bg-gray-200 my-3"></div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Bạn sẽ biết gì:</p>
                                <ul className="space-y-2">
                                    {policy.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                            <span className="material-symbols-outlined text-electric-blue text-base mt-0.5">check_circle</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="mt-auto pt-4 border-t border-gray-200">
                                <Link
                                    href={`/legal/${policy.slug}`}
                                    className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all border flex items-center justify-center gap-2 ${policy.important
                                        ? 'bg-electric-blue hover:shadow-[0_0_20px_rgba(13,166,242,0.3)] text-white border-electric-blue'
                                        : 'bg-white hover:bg-gray-50 border-gray-300 hover:border-electric-blue hover:text-electric-blue text-gray-700'
                                        }`}
                                >
                                    Đọc chi tiết <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
