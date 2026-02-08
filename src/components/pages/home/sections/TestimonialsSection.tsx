import { useTranslation } from 'react-i18next';

export default function TestimonialsSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <h2 className="text-center font-display font-bold text-3xl text-gray-900 mb-12">
        {t('landing.testimonials.title')}
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl bg-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500"></div>
            <div>
              <div className="text-gray-900 font-bold text-sm">{t('landing.testimonials.items.minhTuan.name')}</div>
              <div className="text-xs text-gray-500">{t('landing.testimonials.items.minhTuan.title')}</div>
            </div>
          </div>
          <p className="text-gray-600 text-sm italic">{t('landing.testimonials.items.minhTuan.quote')}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl bg-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-400 to-teal-600"></div>
            <div>
              <div className="text-gray-900 font-bold text-sm">{t('landing.testimonials.items.lanAnh.name')}</div>
              <div className="text-xs text-gray-500">{t('landing.testimonials.items.lanAnh.title')}</div>
            </div>
          </div>
          <p className="text-gray-600 text-sm italic">{t('landing.testimonials.items.lanAnh.quote')}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl bg-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-red-500"></div>
            <div>
              <div className="text-gray-900 font-bold text-sm">{t('landing.testimonials.items.david.name')}</div>
              <div className="text-xs text-gray-500">{t('landing.testimonials.items.david.title')}</div>
            </div>
          </div>
          <p className="text-gray-600 text-sm italic">{t('landing.testimonials.items.david.quote')}</p>
        </div>
      </div>
      <div className="mt-12 glass-panel-heavy rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 border border-electric-blue/20 bg-white">
        <div>
          <div className="text-xs text-electric-blue font-bold uppercase tracking-wider mb-2">
            {t('landing.testimonials.caseStudy.badge')}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('landing.testimonials.caseStudy.title')}</h3>
          <p className="text-gray-600 text-sm max-w-md">{t('landing.testimonials.caseStudy.description')}</p>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{t('landing.testimonials.caseStudy.stats.revenue.value')}</div>
            <div className="text-xs text-gray-500">{t('landing.testimonials.caseStudy.stats.revenue.label')}</div>
          </div>
          <div className="h-10 w-[1px] bg-gray-200"></div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">{t('landing.testimonials.caseStudy.stats.leadQuality.value')}</div>
            <div className="text-xs text-gray-500">{t('landing.testimonials.caseStudy.stats.leadQuality.label')}</div>
          </div>
          <button className="bg-electric-blue text-white px-6 py-3 rounded-full text-sm font-bold transition-colors hover:bg-electric-blue/90 shadow-lg shadow-electric-blue/20">
            {t('landing.testimonials.caseStudy.cta')}
          </button>
        </div>
      </div>
    </section>
  );
}
