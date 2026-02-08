import { useTranslation } from 'react-i18next';

export default function UseCasesSection() {
  const { t } = useTranslation();

  return (
    <section className="py-16 max-w-4xl mx-auto px-6">
      <div className="flex justify-center mb-8">
        <div className="glass-panel p-1 rounded-full inline-flex bg-white border-gray-200">
          <button className="px-6 py-2 rounded-full bg-electric-blue text-white text-sm font-bold shadow-lg">
            {t('landing.useCases.tabs.sales')}
          </button>
          <button className="px-6 py-2 rounded-full text-gray-500 text-sm font-medium hover:text-gray-900 transition-colors">
            {t('landing.useCases.tabs.support')}
          </button>
          <button className="px-6 py-2 rounded-full text-gray-500 text-sm font-medium hover:text-gray-900 transition-colors">
            {t('landing.useCases.tabs.it')}
          </button>
        </div>
      </div>
      <div className="glass-panel p-8 rounded-2xl text-center border-t-2 border-t-electric-blue bg-white shadow-xl">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('landing.useCases.sales.title')}</h3>
        <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-electric-blue/10 flex items-center justify-center text-electric-blue">
              <span className="material-symbols-outlined text-lg">notifications_active</span>
            </div>
            <h4 className="font-bold text-gray-900 text-sm">{t('landing.useCases.sales.features.notify.title')}</h4>
            <p className="text-xs text-gray-600">{t('landing.useCases.sales.features.notify.description')}</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-electric-blue/10 flex items-center justify-center text-electric-blue">
              <span className="material-symbols-outlined text-lg">auto_mode</span>
            </div>
            <h4 className="font-bold text-gray-900 text-sm">{t('landing.useCases.sales.features.autoAssign.title')}</h4>
            <p className="text-xs text-gray-600">{t('landing.useCases.sales.features.autoAssign.description')}</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-electric-blue/10 flex items-center justify-center text-electric-blue">
              <span className="material-symbols-outlined text-lg">attach_money</span>
            </div>
            <h4 className="font-bold text-gray-900 text-sm">{t('landing.useCases.sales.features.close.title')}</h4>
            <p className="text-xs text-gray-600">{t('landing.useCases.sales.features.close.description')}</p>
          </div>
        </div>
        <a href="#" className="text-electric-blue text-sm font-bold hover:underline">
          {t('landing.useCases.sales.ctaLink')}
        </a>
      </div>
    </section>
  );
}
