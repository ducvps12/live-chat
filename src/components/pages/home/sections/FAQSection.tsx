import { useTranslation } from 'react-i18next';

export default function FAQSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 max-w-3xl mx-auto px-6">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">{t('landing.faq.title')}</h2>
      <div className="space-y-4">
        <details className="glass-panel rounded-xl group bg-white">
          <summary className="list-none flex justify-between items-center p-4 cursor-pointer text-gray-900 font-bold">
            {t('landing.faq.items.free.question')}
            <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-gray-500">expand_more</span>
          </summary>
          <div className="px-4 pb-4 text-gray-600 text-sm">{t('landing.faq.items.free.answer')}</div>
        </details>
        <details className="glass-panel rounded-xl group bg-white">
          <summary className="list-none flex justify-between items-center p-4 cursor-pointer text-gray-900 font-bold">
            {t('landing.faq.items.setup.question')}
            <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-gray-500">expand_more</span>
          </summary>
          <div className="px-4 pb-4 text-gray-600 text-sm">{t('landing.faq.items.setup.answer')}</div>
        </details>
        <details className="glass-panel rounded-xl group bg-white">
          <summary className="list-none flex justify-between items-center p-4 cursor-pointer text-gray-900 font-bold">
            {t('landing.faq.items.mobile.question')}
            <span className="material-symbols-outlined transition-transform group-open:rotate-180 text-gray-500">expand_more</span>
          </summary>
          <div className="px-4 pb-4 text-gray-600 text-sm">{t('landing.faq.items.mobile.answer')}</div>
        </details>
      </div>
    </section>
  );
}
