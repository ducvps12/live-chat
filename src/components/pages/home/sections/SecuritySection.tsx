import { useTranslation } from 'react-i18next';

export default function SecuritySection() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-gray-200 py-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-8 md:gap-16 text-gray-600 text-sm font-mono">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 text-lg">verified_user</span>
          {t('landing.security.uptime')}
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-lg">encrypted</span>
          {t('landing.security.encryption')}
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-600 text-lg">dns</span>
          {t('landing.security.gdpr')}
        </div>
        <a href="#" className="flex items-center gap-1 text-gray-900 hover:text-electric-blue underline font-medium">
          {t('landing.security.link')}
        </a>
      </div>
    </section>
  );
}
