import { useTranslation } from 'react-i18next';

const faqs = ['customize', 'integration', 'timeline', 'notFound'];

export default function SolutionsFAQ() {
    const { t } = useTranslation();

    return (
        <section className="py-20 px-6 relative z-10">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
                    {t('solutions.faq.title')}
                </h2>

                <div className="space-y-4">
                    {faqs.map((faqKey) => (
                        <details
                            key={faqKey}
                            className="group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                        >
                            <summary className="flex justify-between items-center font-bold text-lg list-none text-gray-900 p-6 cursor-pointer group-hover:text-electric-blue transition-colors">
                                {t(`solutions.faq.items.${faqKey}.question`)}
                                <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-gray-500">
                                    expand_more
                                </span>
                            </summary>
                            <p className="text-gray-600 px-6 pb-6 leading-relaxed">
                                {t(`solutions.faq.items.${faqKey}.answer`)}
                            </p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
