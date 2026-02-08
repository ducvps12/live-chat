import { useTranslation } from 'react-i18next';

const industries = [
    {
        key: 'ecommerce',
        icon: 'shopping_cart',
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20',
    },
    {
        key: 'saas',
        icon: 'cloud_sync',
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
    },
    {
        key: 'education',
        icon: 'school',
        iconColor: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/20',
    },
    {
        key: 'realestate',
        icon: 'apartment',
        iconColor: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/20',
    },
    {
        key: 'services',
        icon: 'spa',
        iconColor: 'text-pink-500',
        bgColor: 'bg-pink-500/10',
        borderColor: 'border-pink-500/20',
    },
    {
        key: 'agency',
        icon: 'group_work',
        iconColor: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20',
    },
];

export default function IndustrySolutions() {
    const { t } = useTranslation();

    return (
        <section className="py-16 px-6 relative z-10">
            <div className="max-w-[1280px] mx-auto">
                {/* Section Header */}
                <div className="mb-12">
                    <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                        {t('solutions.industries.title')}{' '}
                        <span className="text-electric-blue">{t('solutions.industries.titleHighlight')}</span>
                    </h2>
                    <p className="text-gray-600 text-lg max-w-2xl">
                        {t('solutions.industries.subtitle')}
                    </p>
                </div>

                {/* Industry Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {industries.map((industry) => (
                        <div
                            key={industry.key}
                            className="bg-white border border-gray-200 p-6 rounded-2xl flex flex-col group hover:shadow-xl hover:border-electric-blue/30 hover:-translate-y-1 transition-all duration-300"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div
                                    className={`w-12 h-12 rounded-xl ${industry.bgColor} flex items-center justify-center ${industry.iconColor} border ${industry.borderColor} group-hover:scale-110 transition-transform`}
                                >
                                    <span className="material-symbols-outlined text-2xl">{industry.icon}</span>
                                </div>
                                <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                    {t(`solutions.industries.${industry.key}.badge`)}
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-xl font-bold text-gray-900 mb-4">
                                {t(`solutions.industries.${industry.key}.title`)}
                            </h3>

                            {/* Problem & Result */}
                            <div className="space-y-3 mb-6 flex-grow">
                                <div className="flex gap-2">
                                    <span className="text-xs font-bold text-gray-500 w-16 uppercase">Vấn đề</span>
                                    <span className="text-sm text-gray-700">
                                        {t(`solutions.industries.${industry.key}.problem`)}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-xs font-bold text-electric-teal w-16 uppercase">Kết quả</span>
                                    <span className="text-sm text-gray-900 font-medium">
                                        {t(`solutions.industries.${industry.key}.result`)}
                                    </span>
                                </div>
                                <div className="h-px bg-gray-200 my-3"></div>

                                {/* Features List */}
                                <ul className="space-y-2">
                                    {Object.keys(
                                        t(`solutions.industries.${industry.key}.features`, { returnObjects: true }) as Record<
                                            string,
                                            string
                                        >
                                    ).map((featureKey) => (
                                        <li key={featureKey} className="flex items-center gap-2 text-sm text-gray-600">
                                            <span className="material-symbols-outlined text-electric-blue text-base">check</span>
                                            {t(`solutions.industries.${industry.key}.features.${featureKey}`)}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTAs */}
                            <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-100">
                                <button className="text-sm font-bold text-gray-700 hover:text-electric-blue transition-colors">
                                    {t(`solutions.industries.${industry.key}.ctaView`)}
                                </button>
                                <button className="ml-auto px-4 py-1.5 rounded-full bg-gray-100 hover:bg-electric-blue hover:text-white text-xs font-bold transition-all border border-gray-200 hover:border-electric-blue">
                                    {t(`solutions.industries.${industry.key}.ctaTry`)}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
