import { useTranslation } from 'react-i18next';

export default function ProblemsSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        {/* Problems */}
        <div className="space-y-8">
          <h2 className="font-display font-bold text-3xl text-gray-900">
            {t('landing.problems.title')} <br />
            {t('landing.problems.titleBreak')}
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 border-l-4 border-red-500 bg-red-50 hover:bg-red-100 transition-colors rounded-r-lg">
              <span className="material-symbols-outlined text-red-500 mt-1">
                timer_off
              </span>
              <div>
                <h4 className="text-gray-900 font-bold">
                  {t('landing.problems.items.slow.title')}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {t('landing.problems.items.slow.description')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 border-l-4 border-orange-500 bg-orange-50 hover:bg-orange-100 transition-colors rounded-r-lg">
              <span className="material-symbols-outlined text-orange-500 mt-1">
                person_off
              </span>
              <div>
                <h4 className="text-gray-900 font-bold">
                  {t('landing.problems.items.lostContact.title')}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {t('landing.problems.items.lostContact.description')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 border-l-4 border-yellow-500 bg-yellow-50 hover:bg-yellow-100 transition-colors rounded-r-lg">
              <span className="material-symbols-outlined text-yellow-600 mt-1">
                visibility_off
              </span>
              <div>
                <h4 className="text-gray-900 font-bold">
                  {t('landing.problems.items.noMetrics.title')}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {t('landing.problems.items.noMetrics.description')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Solutions */}
        <div className="grid gap-6">
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 hover:border-electric-blue/50 transition-colors group bg-white">
            <div className="w-12 h-12 rounded-full bg-electric-blue/10 flex items-center justify-center text-electric-blue group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">bolt</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">
                {t('landing.solutions.items.fast.title')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('landing.solutions.items.fast.description')}
              </p>
            </div>
          </div>
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 hover:border-electric-purple/50 transition-colors group bg-white">
            <div className="w-12 h-12 rounded-full bg-electric-purple/10 flex items-center justify-center text-electric-purple group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">contacts</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">
                {t('landing.solutions.items.noLoss.title')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('landing.solutions.items.noLoss.description')}
              </p>
            </div>
          </div>
          <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 hover:border-electric-teal/50 transition-colors group bg-white">
            <div className="w-12 h-12 rounded-full bg-electric-teal/10 flex items-center justify-center text-electric-teal group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">query_stats</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">
                {t('landing.solutions.items.transparent.title')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('landing.solutions.items.transparent.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
