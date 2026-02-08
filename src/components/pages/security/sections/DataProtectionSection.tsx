import Link from 'next/link';

export default function DataProtectionSection() {
    const features = [
        {
            title: 'Mã hóa đường truyền (In-transit)',
            description: 'Mọi kết nối đều qua HTTPS/TLS 1.2+ với chứng chỉ SSL mạnh.',
        },
        {
            title: 'Mã hóa lưu trữ (At-rest)',
            description: 'Cơ sở dữ liệu và file đính kèm được mã hóa AES-256.',
        },
        {
            title: 'Sao lưu (Backups)',
            description: 'Backup định kỳ hàng giờ, mã hóa và lưu trữ phân tán.',
        },
        {
            title: 'Data Minimization',
            description: 'Chỉ thu thập dữ liệu cần thiết cho việc vận hành dịch vụ.',
        },
    ];

    return (
        <section className="max-w-7xl mx-auto px-6 mb-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                {/* Left: Content */}
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-6">Bảo vệ dữ liệu</h2>
                    <p className="text-gray-600 mb-8">
                        Chúng tôi áp dụng các tiêu chuẩn mã hóa công nghiệp để đảm bảo dữ liệu của bạn an toàn dù đang di chuyển hay
                        đang nằm yên.
                    </p>
                    <ul className="space-y-4 mb-8">
                        {features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-electric-blue mt-1">check_circle</span>
                                <div>
                                    <strong className="text-gray-900 block">{feature.title}</strong>
                                    <span className="text-sm text-gray-600">{feature.description}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="flex gap-4">
                        <Link href="#" className="text-electric-blue font-bold hover:text-electric-purple transition-colors text-sm flex items-center gap-1">
                            Chính sách bảo mật
                            <span className="material-symbols-outlined text-sm">arrow_outward</span>
                        </Link>
                        <Link href="#" className="text-gray-600 hover:text-gray-900 transition-colors text-sm">
                            Chính sách Retention
                        </Link>
                    </div>
                </div>

                {/* Right: Diagram */}
                <div className="glass-panel rounded-2xl p-8 relative overflow-hidden bg-white shadow-lg">
                    <div className="flex flex-col items-center gap-8">
                        {/* Client to Gateway */}
                        <div className="flex items-center gap-4 w-full">
                            <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-300 flex flex-col items-center justify-center">
                                <span className="material-symbols-outlined text-gray-700">laptop_mac</span>
                                <span className="text-[10px] text-gray-500 mt-1">Client</span>
                            </div>
                            <div className="flex-1 h-px bg-gradient-to-r from-gray-300 via-electric-blue to-gray-300 relative">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-white border border-electric-blue/30 rounded text-[10px] text-electric-blue font-bold">
                                    TLS 1.3
                                </div>
                            </div>
                            <div className="w-16 h-16 rounded-xl bg-electric-blue/10 border border-electric-blue/30 flex flex-col items-center justify-center shadow-md">
                                <span className="material-symbols-outlined text-electric-blue">cloud_queue</span>
                                <span className="text-[10px] text-electric-blue mt-1 font-bold">Gateway</span>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-gray-300"></div>

                        {/* Secure Network */}
                        <div className="w-full glass-panel p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50">
                            <div className="text-[10px] text-gray-500 uppercase mb-4 text-center font-bold">Secure VPC Network</div>
                            <div className="flex justify-between items-center gap-4">
                                <div className="flex-1 p-3 rounded bg-white border border-gray-200 text-center">
                                    <span className="material-symbols-outlined text-gray-700 mb-1">dns</span>
                                    <div className="text-xs text-gray-900 font-medium">App Cluster</div>
                                </div>
                                <div className="w-8 h-px bg-gray-400"></div>
                                <div className="flex-1 p-3 rounded bg-white border border-electric-blue/30 text-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-electric-blue/5"></div>
                                    <span className="material-symbols-outlined text-electric-blue mb-1">lock</span>
                                    <div className="text-xs text-gray-900 font-medium">Encrypted DB</div>
                                    <div className="text-[9px] text-gray-500 mt-1">AES-256</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
