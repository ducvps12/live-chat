export default function CustomerStatsSection() {
    const stats = [
        { value: '+32%', label: 'Lead để lại thông tin', color: 'text-green-600' },
        { value: '-41%', label: 'First Response Time', color: 'text-electric-blue' },
        { value: '-28%', label: 'Missed Chats', color: 'text-electric-purple' },
    ];

    const customers = [
        { name: 'RocketSaaS', icon: 'rocket_launch' },
        { name: 'BlueWave', icon: 'water_drop' },
        { name: 'EnergyX', icon: 'bolt' },
        { name: 'GlobalTech', icon: 'deployed_code' },
        { name: 'TokenFlow', icon: 'token' },
        { name: 'NetCore', icon: 'hub' },
    ];

    return (
        <section className="py-12 border-y border-gray-200 bg-gradient-to-br from-electric-blue/5 to-electric-purple/5 relative z-10">
            <div className="max-w-[1280px] mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                    {/* Stats */}
                    <div className="flex flex-wrap justify-center gap-8 lg:gap-12 w-full lg:w-auto shrink-0">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center lg:text-left">
                                <div className={`text-3xl lg:text-4xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px h-16 bg-gray-300"></div>

                    {/* Customer logos */}
                    <div className="flex flex-wrap justify-center lg:justify-start items-center gap-8 lg:gap-12 opacity-60 hover:opacity-100 transition-all duration-500 w-full">
                        {customers.map((customer, index) => (
                            <div key={index} className="flex items-center gap-2 text-lg font-bold text-gray-700">
                                <span className="material-symbols-outlined">{customer.icon}</span>
                                {customer.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
