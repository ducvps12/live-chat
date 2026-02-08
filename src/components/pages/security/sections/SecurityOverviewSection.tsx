export default function SecurityOverviewSection() {
    const features = [
        {
            icon: 'lock',
            title: 'Bảo vệ dữ liệu',
            description: 'Mã hóa AES-256 khi lưu trữ và TLS 1.3 khi truyền tải.',
            color: 'blue',
        },
        {
            icon: 'admin_panel_settings',
            title: 'Kiểm soát truy cập',
            description: 'Phân quyền chi tiết (RBAC) đến từng tính năng và inbox.',
            color: 'purple',
        },
        {
            icon: 'visibility',
            title: 'Truy vết & Audit',
            description: 'Ghi log mọi hành động nhạy cảm của nhân viên.',
            color: 'emerald',
        },
        {
            icon: 'apartment',
            title: 'Tách biệt Tenant',
            description: 'Dữ liệu được cô lập logic theo Workspace ID.',
            color: 'orange',
        },
        {
            icon: 'autorenew',
            title: 'Vòng đời dữ liệu',
            description: 'Tự động xóa hoặc lưu trữ theo chính sách Retention.',
            color: 'teal',
        },
        {
            icon: 'health_and_safety',
            title: 'Vận hành',
            description: 'Quy trình ứng phó sự cố (Incident Response) 24/7.',
            color: 'red',
        },
        {
            icon: 'hub',
            title: 'Tích hợp an toàn',
            description: 'Webhooks có chữ ký số xác thực nguồn gốc.',
            color: 'pink',
        },
        {
            icon: 'light_mode',
            title: 'Minh bạch',
            description: 'Status page công khai và thông báo bảo trì rõ ràng.',
            color: 'indigo',
        },
    ];

    const getColorClasses = (color: string) => {
        const colorMap: Record<string, string> = {
            blue: 'bg-blue-500/10 text-blue-500',
            purple: 'bg-purple-500/10 text-purple-500',
            emerald: 'bg-emerald-500/10 text-emerald-500',
            orange: 'bg-orange-500/10 text-orange-500',
            teal: 'bg-teal-500/10 text-teal-500',
            red: 'bg-red-500/10 text-red-500',
            pink: 'bg-pink-500/10 text-pink-500',
            indigo: 'bg-indigo-500/10 text-indigo-500',
        };
        return colorMap[color] || colorMap.blue;
    };

    return (
        <section className="max-w-7xl mx-auto px-6 mb-32">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                <span className="w-1 h-8 bg-electric-blue rounded-full"></span>
                Tổng quan bảo mật
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                    <div key={index} className="glass-panel p-6 rounded-xl bg-white hover:-translate-y-1 transition-all duration-300 shadow-md">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${getColorClasses(feature.color)}`}>
                            <span className="material-symbols-outlined">{feature.icon}</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                        <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
