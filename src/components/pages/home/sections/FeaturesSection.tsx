import { useTranslation } from 'react-i18next';

export default function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-electric-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-xl font-bold text-gray-900 mb-2 relative z-10">
            {t('landing.features.leadCapture.title')}
          </h3>
          <p className="text-sm text-gray-600 mb-4 relative z-10">
            {t('landing.features.leadCapture.description')}
          </p>
          <div className="text-[10px] text-electric-blue border-t border-gray-200 pt-3 relative z-10 font-medium">
            {t('landing.features.leadCapture.how')}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-electric-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-xl font-bold text-gray-900 mb-2 relative z-10">
            {t('landing.features.unifiedInbox.title')}
          </h3>
          <p className="text-sm text-gray-600 mb-4 relative z-10">
            {t('landing.features.unifiedInbox.description')}
          </p>
          <div className="text-[10px] text-electric-purple border-t border-gray-200 pt-3 relative z-10 font-medium">
            {t('landing.features.unifiedInbox.how')}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-electric-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-xl font-bold text-gray-900 mb-2 relative z-10">
            {t('landing.features.autoAssign.title')}
          </h3>
          <p className="text-sm text-gray-600 mb-4 relative z-10">
            {t('landing.features.autoAssign.description')}
          </p>
          <div className="text-[10px] text-electric-teal border-t border-gray-200 pt-3 relative z-10 font-medium">
            {t('landing.features.autoAssign.how')}
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 bg-white">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-xl font-bold text-gray-900 mb-2 relative z-10">
            {t('landing.features.sla.title')}
          </h3>
          <p className="text-sm text-gray-600 mb-4 relative z-10">
            {t('landing.features.sla.description')}
          </p>
          <div className="text-[10px] text-gray-500 border-t border-gray-200 pt-3 relative z-10 font-medium">
            {t('landing.features.sla.how')}
          </div>
        </div>
      </div>
    </section>
  );
}
