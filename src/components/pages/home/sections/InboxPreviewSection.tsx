import { useTranslation } from 'react-i18next';

export default function InboxPreviewSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-white pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-2/3 w-full">
            <div className="relative rounded-xl border border-electric-blue/20 bg-white shadow-2xl overflow-hidden group">
              <div className="h-12 border-b border-gray-200 flex items-center px-4 gap-4 bg-gray-50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                </div>
                <div className="h-6 w-1/3 bg-gray-200 rounded border border-gray-300/50"></div>
              </div>
              <div className="h-[400px] flex">
                <div className="w-64 border-r border-gray-200 bg-gray-50/50"></div>
                <div className="flex-1 flex flex-col relative bg-white">
                  <div className="flex-1 p-6 space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                      <div className="glass-panel p-3 rounded-2xl rounded-tl-none max-w-md bg-gray-100 border-gray-200">
                        <div className="h-2 w-48 bg-gray-300 rounded"></div>
                      </div>
                    </div>
                    <div className="flex gap-4 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-electric-blue"></div>
                      <div className="bg-electric-blue p-3 rounded-2xl rounded-tr-none max-w-md text-white shadow-lg shadow-electric-blue/20">
                        <p className="text-xs">{t('landing.inbox.mockupMessage')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-electric-blue/5 to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-blue to-transparent opacity-50"></div>
                </div>
                <div className="w-72 border-l border-gray-200 bg-gray-50/50"></div>
              </div>
            </div>
          </div>
          <div className="lg:w-1/3 space-y-8">
            <h2 className="text-3xl font-bold font-display text-gray-900">
              {t('landing.inbox.title')} <br />
              {t('landing.inbox.titleBreak')}
            </h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-electric-blue mt-0.5">check_circle</span>
                <span className="text-gray-600 font-medium">{t('landing.inbox.features.threeColumn')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-electric-blue mt-0.5">check_circle</span>
                <span className="text-gray-600 font-medium">{t('landing.inbox.features.hotkeys')}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="material-symbols-outlined text-electric-blue mt-0.5">check_circle</span>
                <span className="text-gray-600 font-medium">{t('landing.inbox.features.darkMode')}</span>
              </li>
            </ul>
            <div className="flex flex-col gap-3">
              <button className="w-full bg-electric-blue hover:bg-electric-blue/80 text-white font-bold py-3 rounded-full shadow-[0_0_20px_rgba(13,166,242,0.3)] transition-all">
                {t('landing.inbox.ctaPrimary')}
              </button>
              <button className="w-full text-gray-500 hover:text-electric-blue font-medium py-2 text-sm flex items-center justify-center gap-2">
                {t('landing.inbox.ctaSecondary')} <span className="material-symbols-outlined text-sm">open_in_new</span>
              </button>
            </div>
            <a href="#" className="block text-center text-xs text-electric-teal hover:underline font-medium">
              {t('landing.inbox.docsLink')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
