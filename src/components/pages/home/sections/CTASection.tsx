import { useTranslation } from 'react-i18next';

export default function CTASection() {
  const { t } = useTranslation();

  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-t from-electric-blue/5 to-transparent pointer-events-none"></div>
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <h2 className="text-4xl lg:text-5xl font-display font-bold text-gray-900 mb-6">
          {t('landing.cta.title')} <br />
          {t('landing.cta.titleBreak')}
        </h2>
        <p className="text-lg text-gray-600 mb-8 font-mono">{t('landing.cta.subtitle')}</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button className="bg-electric-blue text-white px-10 py-4 rounded-full font-bold text-lg shadow-[0_0_40px_rgba(13,166,242,0.3)] hover:bg-electric-blue/90 hover:scale-105 transition-all">
            {t('landing.cta.ctaPrimary')}
          </button>
          <button className="bg-white border border-gray-300 text-gray-700 px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm">
            {t('landing.cta.ctaSecondary')}
          </button>
        </div>
        <p className="mt-6 text-xs text-gray-500">{t('landing.cta.disclaimer')}</p>
      </div>
    </section>
  );
}
