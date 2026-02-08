import { useTranslation } from 'react-i18next';
import Link from 'next/link';

interface HeroSectionProps {
    isYearly: boolean;
    onToggle: () => void;
}

export default function HeroSection({ isYearly, onToggle }: HeroSectionProps) {
    const { t } = useTranslation();

    return (
        <section className="relative z-10 pt-32 pb-16 lg:pt-44 lg:pb-16 px-6 text-center">
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 relative">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-electric-blue/30 bg-electric-blue/5 text-electric-blue backdrop-blur-sm">
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {t('pricing.hero.badge', 'Bảng giá minh bạch')}
                    </span>
                </div>

                {/* Headline */}
                <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-gray-900">
                    {t('pricing.hero.title', 'Chọn gói phù hợp với')}<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-purple-500 to-electric-teal">
                        {t('pricing.hero.titleHighlight', 'quy mô team của bạn.')}
                    </span>
                </h1>

                {/* Subtitle */}
                <p className="text-lg lg:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
                    {t('pricing.hero.subtitle', 'Bắt đầu miễn phí. Khi tăng trưởng, nâng gói trong 1 click — không gián đoạn inbox.')}
                </p>

                {/* Toggle Monthly/Yearly */}
                <div className="flex items-center justify-center gap-4 mt-4 relative">
                    <span className="text-gray-600 font-bold text-sm">
                        {t('pricing.hero.monthly', 'Theo tháng')}
                    </span>
                    <button
                        onClick={onToggle}
                        className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${isYearly ? 'bg-electric-blue' : 'bg-gray-300'
                            }`}
                    >
                        <span
                            className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${isYearly ? 'left-7' : 'left-1'
                                }`}
                        />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-bold text-sm">
                            {t('pricing.hero.yearly', 'Theo năm')}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-purple-500 to-electric-blue text-white px-2 py-0.5 rounded-full">
                            {t('pricing.hero.yearlyDiscount', 'Tiết kiệm 20%')}
                        </span>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                    <Link
                        href="/auth/register"
                        className="h-12 px-8 bg-electric-blue hover:bg-electric-blue/90 text-white text-base font-bold rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                        {t('pricing.hero.ctaPrimary', 'Dùng thử miễn phí')}
                    </Link>
                    <button className="h-12 px-8 bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 text-base font-bold rounded-full flex items-center justify-center gap-2 group transition-all">
                        <span className="material-symbols-outlined group-hover:text-electric-blue transition-colors">call</span>
                        {t('pricing.hero.ctaSecondary', 'Liên hệ sales')}
                    </button>
                </div>

                {/* Trust badges */}
                <div className="mt-6 flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-gray-500 font-medium">
                    <span>{t('pricing.hero.noCard', 'Không cần thẻ')}</span>
                    <span className="text-gray-300 text-xs">•</span>
                    <span>{t('pricing.hero.cancelAnytime', 'Hủy bất kỳ lúc nào')}</span>
                    <span className="text-gray-300 text-xs">•</span>
                    <span>{t('pricing.hero.setupSupport', 'Hỗ trợ cài đặt')}</span>
                </div>
            </div>
        </section>
    );
}
