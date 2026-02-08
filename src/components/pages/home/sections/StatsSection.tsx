import { useTranslation } from 'react-i18next';

export default function StatsSection() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-gray-200 bg-gray-50/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row items-center justify-between gap-8">
        <div className="flex gap-8 divide-x divide-gray-200">
          <div className="px-4 first:pl-0">
            <p className="text-2xl font-bold text-gray-900 font-display">
              {t('landing.stats.leadCaptured.value')}
            </p>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              {t('landing.stats.leadCaptured.label')}
            </p>
          </div>
          <div className="px-4">
            <p className="text-2xl font-bold text-gray-900 font-display">
              {t('landing.stats.responseTime.value')}
            </p>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              {t('landing.stats.responseTime.label')}
            </p>
          </div>
          <div className="px-4">
            <p className="text-2xl font-bold text-gray-900 font-display">
              {t('landing.stats.missedChats.value')}
            </p>
            <p className="text-xs text-gray-600 uppercase tracking-wide">
              {t('landing.stats.missedChats.label')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-8 opacity-40 grayscale filter">
          <div className="h-6 w-20 bg-gray-300 rounded"></div>
          <div className="h-6 w-20 bg-gray-300 rounded"></div>
          <div className="h-6 w-20 bg-gray-300 rounded"></div>
          <div className="h-6 w-20 bg-gray-300 rounded hidden sm:block"></div>
          <div className="h-6 w-20 bg-gray-300 rounded hidden sm:block"></div>
        </div>
      </div>
    </section>
  );
}
