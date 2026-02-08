export default function DemoSocialProofSection() {
    const customers = [
        { name: 'Acme Corp', icon: 'diamond' },
        { name: 'TechGlobal', icon: 'deployed_code' },
        { name: 'BlueWave', icon: 'water_drop' },
        { name: 'EnergyX', icon: 'bolt' },
    ];

    const stats = [
        { value: '-50%', label: 'Thời gian phản hồi đầu tiên', color: 'text-electric-blue' },
        { value: '+35%', label: 'Lead thu được từ web', color: 'text-electric-purple' },
    ];

    return (
        <section className="py-16 px-6 bg-gradient-to-br from-electric-blue/5 to-electric-purple/5 border-y border-gray-200">
            <div className="max-w-[1280px] mx-auto">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
                    {/* Left: Logos & Testimonial */}
                    <div className="w-full lg:w-1/2">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">Được tin cậy bởi 500+ doanh nghiệp</p>
                        <div className="flex flex-wrap gap-8 items-center opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                            {customers.map((customer, index) => (
                                <div key={index} className="flex items-center gap-2 text-lg font-bold text-gray-700">
                                    <span className="material-symbols-outlined">{customer.icon}</span> {customer.name}
                                </div>
                            ))}
                        </div>

                        {/* Testimonial */}
                        <div className="mt-8 pt-8 border-t border-gray-200">
                            <div className="glass-panel p-4 rounded-lg inline-block bg-white shadow-sm">
                                <p className="text-sm text-gray-700 italic">
                                    "Nemark Inbox giúp team sales của chúng tôi không bỏ lỡ bất kỳ lead nào từ website. Tốc độ phản hồi tăng
                                    gấp đôi."
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="size-6 rounded-full bg-gradient-to-br from-electric-blue to-electric-purple"></div>
                                    <div className="text-xs font-bold text-gray-900">Minh Hoàng, CEO TechGlobal</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Stats */}
                    <div className="w-full lg:w-5/12 grid grid-cols-2 gap-4">
                        {stats.map((stat, index) => (
                            <div key={index} className="glass-panel p-5 rounded-xl text-center bg-white hover:bg-gray-50 transition-colors shadow-md">
                                <div className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
                                <div className="text-xs text-gray-600">{stat.label}</div>
                            </div>
                        ))}

                        {/* Combined stat */}
                        <div className="glass-panel p-5 rounded-xl text-center bg-white hover:bg-gray-50 transition-colors col-span-2 flex items-center justify-center gap-4 shadow-md">
                            <div className="text-3xl font-bold text-green-500 mb-1">0%</div>
                            <div className="text-xs text-gray-600 text-left">
                                Missed Chats
                                <br />
                                nhờ routing thông minh
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
