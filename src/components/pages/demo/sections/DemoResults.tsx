import { useTranslation } from 'react-i18next';

const results = [
    {
        key: 'leadQuality',
        icon: 'trending_up',
        gradient: 'from-blue-500 to-cyan-400',
        shadow: 'shadow-blue-500/20',
    },
    {
        key: 'responseTime',
        icon: 'schedule',
        gradient: 'from-purple-500 to-pink-400',
        shadow: 'shadow-purple-500/20',
    },
    {
        key: 'missedChat',
        icon: 'support_agent',
        gradient: 'from-orange-500 to-red-400',
        shadow: 'shadow-orange-500/20',
    },
    {
        key: 'transparency',
        icon: 'visibility',
        gradient: 'from-teal-500 to-emerald-400',
        shadow: 'shadow-teal-500/20',
    },
];

export default function DemoResults() {
    const { t } = useTranslation();

    return (
        <section className="py-24 px-6 relative z-10 bg-white">
            <div className="max-w-[1280px] mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold mb-4 text-gray-900">{t('demo.results.title')}</h2>
                    <p className="text-gray-600">{t('demo.results.subtitle')}</p>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {results.map((result) => (
                        <div
                            key={result.key}
                            className="bg-white border border-gray-200 p-8 rounded-3xl flex flex-col items-center text-center hover:-translate-y-2 hover:shadow-xl transition-all duration-300"
                        >
                            {/* Icon */}
                            <div
                                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${result.gradient} flex items-center justify-center mb-6 shadow-lg ${result.shadow}`}
                            >
                                <span className="material-symbols-outlined text-3xl text-white">{result.icon}</span>
                            </div>

                            {/* Value */}
                            <h3 className="text-4xl font-bold text-gray-900 mb-2">
                                {t(`demo.results.${result.key}.value`)}
                            </h3>

                            {/* Title */}
                            <p className="font-bold text-lg mb-2 text-gray-800">
                                {t(`demo.results.${result.key}.title`)}
                            </p>

                            {/* Description */}
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {t(`demo.results.${result.key}.description`)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
