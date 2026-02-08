import { useTranslation } from 'react-i18next';

const steps = [
    { key: 'step1', color: 'border-electric-blue text-electric-blue shadow-[0_0_15px_rgba(13,166,242,0.2)]' },
    { key: 'step2', color: 'border-gray-300 text-gray-700 hover:border-purple-500 hover:text-purple-500' },
    { key: 'step3', color: 'border-gray-300 text-gray-700 hover:border-electric-teal hover:text-electric-teal' },
    { key: 'step4', color: 'border-gray-300 text-gray-700 hover:border-orange-500 hover:text-orange-500' },
];

export default function PlaybookSection() {
    const { t } = useTranslation();

    return (
        <section className="py-24 px-6 bg-white relative z-10 border-y border-gray-200">
            <div className="max-w-[1000px] mx-auto">
                <h2 className="text-3xl font-bold text-center mb-16 text-gray-900">
                    {t('solutions.playbook.title')}{' '}
                    <span className="text-electric-blue">{t('solutions.playbook.titleHighlight')}</span>
                </h2>

                <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200 hidden md:block"></div>

                    {/* Steps Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {steps.map((step, index) => (
                            <div key={step.key} className="relative group">
                                {/* Number Badge */}
                                <div
                                    className={`w-16 h-16 rounded-full bg-white border-2 ${step.color} flex items-center justify-center font-bold text-xl mx-auto md:mx-0 mb-6 relative z-10 transition-all duration-300`}
                                >
                                    {t(`solutions.playbook.${step.key}.number`)}
                                </div>

                                {/* Content */}
                                <h3 className="text-lg font-bold text-gray-900 mb-2">
                                    {t(`solutions.playbook.${step.key}.title`)}
                                </h3>
                                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    {t(`solutions.playbook.${step.key}.description`)}
                                </p>

                                {/* CTA */}
                                {index === 3 ? (
                                    <button className="px-4 py-2 rounded-full bg-electric-blue hover:bg-electric-blue/90 text-xs font-bold text-white transition-all shadow-md hover:shadow-lg">
                                        {t(`solutions.playbook.${step.key}.cta`)}
                                    </button>
                                ) : (
                                    <a
                                        href="#"
                                        className="text-xs font-bold text-electric-teal hover:text-electric-blue transition-colors hover:underline"
                                    >
                                        {t(`solutions.playbook.${step.key}.cta`)}
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
