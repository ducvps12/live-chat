import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export default function FinalCTA() {
    const { t } = useTranslation();

    return (
        <section className="py-32 px-6 relative z-10 overflow-hidden bg-gradient-to-b from-white via-blue-50/30 to-purple-50/20">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-gradient-to-t from-electric-blue/10 via-transparent to-transparent pointer-events-none"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
                <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight text-gray-900">
                    {t('solutions.finalCta.title')}{' '}
                    <span className="text-electric-blue">{t('solutions.finalCta.titleHighlight')}</span>
                </h2>
                <p className="text-xl text-gray-600 mb-10">
                    {t('solutions.finalCta.subtitle')}
                </p>
                <Link href="/auth/register" className="inline-block h-14 px-10 bg-electric-blue hover:bg-electric-blue/90 text-white text-lg font-bold rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 active:scale-95 leading-[56px]">
                    {t('solutions.finalCta.button')}
                </Link>
                <p className="text-sm text-gray-500 mt-6">
                    {t('solutions.finalCta.disclaimer')}
                </p>
            </div>
        </section>
    );
}
