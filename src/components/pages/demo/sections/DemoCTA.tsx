import { useTranslation } from 'react-i18next';

export default function DemoCTA() {
    const { t } = useTranslation();

    return (
        <section className="py-24 px-6 relative overflow-hidden text-center bg-gradient-to-b from-white to-gray-50">
            <div className="max-w-3xl mx-auto relative z-10">
                {/* Title */}
                <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-gray-900">
                    {t('demo.cta.title')}
                </h2>

                {/* Workflow */}
                <div className="flex items-center justify-center gap-2 text-gray-600 mb-10 flex-wrap font-mono text-sm">
                    <span>{t('demo.cta.workflow.copy')}</span>
                    <span className="material-symbols-outlined text-sm text-electric-blue">arrow_forward</span>
                    <span>{t('demo.cta.workflow.receive')}</span>
                    <span className="material-symbols-outlined text-sm text-electric-blue">arrow_forward</span>
                    <span>{t('demo.cta.workflow.save')}</span>
                    <span className="material-symbols-outlined text-sm text-electric-blue">arrow_forward</span>
                    <span>{t('demo.cta.workflow.measure')}</span>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button className="h-14 px-10 bg-electric-blue hover:bg-electric-blue/90 text-white text-lg font-bold rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1">
                        {t('demo.cta.ctaPrimary')}
                    </button>
                    <button className="h-14 px-10 bg-transparent border-2 border-gray-300 hover:border-electric-blue hover:bg-electric-blue/5 text-gray-700 hover:text-electric-blue text-lg font-bold rounded-full transition-all flex items-center gap-2">
                        {t('demo.cta.ctaSecondary')}
                        <span className="material-symbols-outlined">groups</span>
                    </button>
                </div>

                {/* Disclaimer */}
                <p className="mt-8 text-sm text-gray-500">{t('demo.cta.disclaimer')}</p>
            </div>
        </section>
    );
}
