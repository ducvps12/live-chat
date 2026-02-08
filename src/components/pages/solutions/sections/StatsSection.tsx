import { useTranslation } from 'react-i18next';

export default function StatsSection() {
    const { t } = useTranslation();

    return (
        <section className="border-y border-gray-200 bg-white/50 backdrop-blur-sm relative z-10">
            <div className="max-w-[1280px] mx-auto px-6 py-6 flex flex-wrap justify-center md:justify-between items-center gap-6">
                {/* Brands (Optional - can be added later) */}
                <div className="flex items-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
                        <span className="material-symbols-outlined">diamond</span> Acme
                    </div>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
                        <span className="material-symbols-outlined">rocket_launch</span> SaaSOne
                    </div>
                    <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
                        <span className="material-symbols-outlined">water_drop</span> BlueWave
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-8">
                    <div className="text-center">
                        <div className="text-xl font-bold text-gray-900">
                            {t('solutions.stats.conversations')}
                        </div>
                        <div className="text-xs text-gray-500 uppercase">
                            {t('solutions.stats.conversationsLabel')}
                        </div>
                    </div>
                    <div className="w-px h-8 bg-gray-300"></div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-gray-900">
                            {t('solutions.stats.uptime')}
                        </div>
                        <div className="text-xs text-gray-500 uppercase">
                            {t('solutions.stats.uptimeLabel')}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
