import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export default function SolutionsHero() {
    const { t } = useTranslation();

    return (
        <section className="relative z-10 pt-32 pb-16 lg:pt-40 lg:pb-20 max-w-7xl mx-auto px-6 text-center">
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-electric-blue/30 bg-electric-blue/5">
                    <span className="text-xs font-bold uppercase tracking-wider text-electric-blue">
                        {t('solutions.hero.badge')}
                    </span>
                </div>

                {/* Title */}
                <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-gray-900">
                    {t('solutions.hero.title')}<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-electric-teal to-purple-500 animate-gradient-x">
                        {t('solutions.hero.titleHighlight')}
                    </span>{' '}
                    {t('solutions.hero.titleEnd')}
                </h1>

                {/* Subtitle */}
                <p className="text-lg lg:text-xl text-gray-600 leading-relaxed max-w-2xl">
                    {t('solutions.hero.subtitle')}
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                    <Link href="/auth/register" className="h-12 px-8 bg-electric-blue hover:bg-electric-blue/90 text-white text-base font-bold rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                        {t('solutions.hero.ctaPrimary')}
                    </Link>
                    <Link href="/home#demo" className="h-12 px-8 bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-base font-bold rounded-full flex items-center justify-center gap-2 group transition-all">
                        <span className="material-symbols-outlined group-hover:text-electric-blue transition-colors">
                            play_circle
                        </span>
                        {t('solutions.hero.ctaSecondary')}
                    </Link>
                </div>

                {/* Features */}
                <div className="flex items-center gap-6 text-sm text-gray-500 font-medium mt-2">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-green-500 text-lg">verified_user</span>
                        {t('solutions.hero.features.setup')}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-green-500 text-lg">credit_card_off</span>
                        {t('solutions.hero.features.noCard')}
                    </span>
                </div>
            </div>
        </section>
    );
}
