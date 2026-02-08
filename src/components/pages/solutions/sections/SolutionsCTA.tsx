import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export default function SolutionsCTA() {
    const { t } = useTranslation();

    return (
        <section className="py-10 px-6">
            <div className="max-w-[1280px] mx-auto">
                <div className="bg-gradient-to-r from-electric-blue/10 to-purple-100/30 border border-electric-blue/20 p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg">
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-electric-blue/5 to-transparent blur-2xl pointer-events-none"></div>

                    {/* Content */}
                    <div className="relative z-10">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            {t('solutions.midCta.title')}
                        </h3>
                        <p className="text-gray-700">{t('solutions.midCta.subtitle')}</p>
                    </div>

                    {/* CTAs */}
                    <div className="flex items-center gap-4 relative z-10">
                        <Link
                            href="/home#demo"
                            className="text-sm font-bold text-gray-700 hover:text-electric-blue transition-colors"
                        >
                            {t('solutions.midCta.ctaDemo')}
                        </Link>
                        <Link href="/auth/register" className="h-10 px-6 bg-white text-gray-900 hover:bg-gray-100 text-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all border border-gray-200 flex items-center justify-center">
                            {t('solutions.midCta.ctaTry')}
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
