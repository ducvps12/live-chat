import { useTranslation } from 'react-i18next';

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative z-10 pt-32 pb-16 lg:pt-40 lg:pb-24 max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 lg:gap-8 items-center min-h-[90vh]">
      {/* Left Column - Content */}
      <div className="lg:col-span-6 flex flex-col gap-6 relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-electric-blue/30 bg-electric-blue/5 w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-electric-blue animate-pulse"></span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-electric-blue">
            {t('landing.hero.badge')}
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display font-bold text-5xl lg:text-7xl leading-[1.1] text-gray-900 tracking-tight">
          {t('landing.hero.title')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-purple-500 to-electric-teal animate-gradient-x">
            {t('landing.hero.titleHighlight')}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
          {t('landing.hero.subtitle')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4">
          <button className="relative overflow-hidden rounded-full bg-electric-blue text-white px-8 py-4 font-bold text-base transition-all hover:shadow-[0_0_30px_rgba(13,166,242,0.4)] active:scale-95 group">
            <span className="relative z-10 flex items-center gap-2">
              {t('landing.hero.ctaPrimary')}
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          </button>

          <button className="rounded-full px-8 py-4 font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">
              play_circle
            </span>
            {t('landing.hero.ctaSecondary')}
          </button>
        </div>

        {/* Features List */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-gray-500 mt-2 font-mono">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-electric-teal">
              check
            </span>
            {t('landing.hero.features.noCard')}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-electric-teal">
              check
            </span>
            {t('landing.hero.features.quickSetup')}
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-electric-teal">
              check
            </span>
            {t('landing.hero.features.support')}
          </span>
        </div>

        {/* Enterprise Badge */}
        <div className="pt-6 border-t border-gray-200 mt-4 flex items-center gap-6 opacity-80 hover:opacity-100 transition-all duration-500">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1 text-electric-blue">
              <span className="material-symbols-outlined text-[16px]">
                security
              </span>
              <span className="material-symbols-outlined text-[16px]">
                lock
              </span>
              <span className="material-symbols-outlined text-[16px]">api</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-700">
              {t('landing.hero.enterprise.title')}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-gray-300"></div>
          <span className="text-xs text-gray-600">{t('landing.hero.enterprise.features')}</span>
        </div>
      </div>

      {/* Right Column - 3D Mockup */}
      <div className="lg:col-span-6 relative h-[500px] w-full perspective-1000 animate-float select-none">
        {/* Beam Line */}
        <div className="absolute top-[60%] left-[20%] right-[30%] h-[2px] bg-gradient-to-r from-electric-blue/50 to-electric-purple/50 z-0">
          <div className="absolute top-0 left-0 w-20 h-full bg-white blur-[2px] animate-beam-flow"></div>
        </div>

        {/* Widget Mockup */}
        <div className="absolute bottom-10 left-0 w-64 glass-panel rounded-2xl p-4 z-20 border-glow transform rotate-y-12 transition-transform hover:scale-105 duration-500 bg-white">
          <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <div className="w-16 h-2 bg-gray-100 rounded ml-auto"></div>
          </div>
          <div className="space-y-3">
            <div className="bg-gray-50 p-2 rounded-lg rounded-tl-none w-[85%] ml-auto border border-gray-100">
              <div className="h-2 w-full bg-gray-200 rounded mb-1"></div>
              <div className="h-2 w-2/3 bg-gray-200 rounded"></div>
            </div>
            <div className="bg-electric-blue/10 p-2 rounded-lg rounded-br-none w-[85%] border border-electric-blue/20">
              <div className="h-2 w-full bg-electric-blue/20 rounded mb-1"></div>
              <div className="h-2 w-1/2 bg-electric-blue/20 rounded"></div>
            </div>
            <div className="flex gap-1 ml-2">
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
          <div className="absolute -top-4 -right-12 px-3 py-1 glass-panel rounded-full text-[10px] text-electric-blue border-electric-blue/30 whitespace-nowrap bg-white">
            {t('landing.hero.mockup.widgetLabel')}
          </div>
        </div>

        {/* Inbox Mockup */}
        <div className="absolute top-10 right-0 w-[400px] glass-panel-heavy rounded-2xl border-glow z-10 shadow-2xl bg-white">
          <div className="h-10 border-b border-gray-200 flex items-center px-4 justify-between">
            <div className="flex gap-2">
              <div className="w-20 h-2 bg-gray-200 rounded"></div>
            </div>
            <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded border border-green-500/20 flex items-center gap-1 font-medium">
              <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
              {t('landing.hero.mockup.realtimeBadge')}
            </span>
          </div>
          <div className="flex h-64">
            <div className="w-1/4 border-r border-gray-200 p-2 space-y-2">
              <div className="h-8 bg-gray-100 rounded"></div>
              <div className="h-8 bg-transparent rounded border border-gray-100"></div>
              <div className="h-8 bg-transparent rounded border border-gray-100"></div>
            </div>
            <div className="w-1/2 border-r border-gray-200 p-3 flex flex-col">
              <div className="flex-1 space-y-2">
                <div className="bg-gray-50 p-2 rounded w-3/4 border border-gray-100">
                  <div className="h-1.5 w-full bg-gray-200 rounded"></div>
                </div>
                <div className="bg-electric-blue/10 p-2 rounded w-3/4 ml-auto border border-electric-blue/20">
                  <div className="h-1.5 w-full bg-electric-blue/20 rounded"></div>
                </div>
              </div>
              <div className="mt-2 h-8 border border-gray-200 rounded flex items-center px-2 text-[10px] text-gray-400">
                {t('landing.hero.mockup.chatPlaceholder')}
              </div>
            </div>
            <div className="w-1/4 p-2 space-y-2">
              <div className="h-8 w-8 rounded-full bg-purple-100 mx-auto"></div>
              <div className="h-2 w-16 bg-gray-100 rounded mx-auto"></div>
              <div className="pt-2 border-t border-gray-100">
                <div className="text-[8px] text-gray-400 mb-1">{t('landing.hero.mockup.source')}</div>
                <div className="px-1 py-0.5 bg-yellow-50 text-yellow-600 text-[8px] rounded border border-yellow-200 text-center font-medium">
                  {t('landing.hero.mockup.utmAds')}
                </div>
              </div>
              <div className="pt-1">
                <div className="px-1 py-0.5 bg-purple-50 text-purple-600 text-[8px] rounded border border-purple-200 text-center font-medium">
                  {t('landing.hero.mockup.qualified')}
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -left-12 top-20 px-3 py-1 glass-panel rounded-full text-[10px] text-electric-purple border-electric-purple/30 whitespace-nowrap bg-white">
            {t('landing.hero.mockup.inboxLabel')}
          </div>
        </div>

        {/* SLA Chart Mockup */}
        <div className="absolute bottom-0 right-20 w-48 glass-panel rounded-xl p-3 z-30 opacity-95 bg-white shadow-lg">
          <div className="text-[10px] text-gray-500 mb-2 flex justify-between">
            <span className="font-medium">{t('landing.hero.mockup.responseTime')}</span>
            <span className="text-green-500 text-xs font-bold">▼ 45%</span>
          </div>
          <div className="flex items-end gap-1 h-12">
            <div className="w-1/5 bg-electric-blue/20 h-[80%] rounded-t-sm"></div>
            <div className="w-1/5 bg-electric-blue/30 h-[60%] rounded-t-sm"></div>
            <div className="w-1/5 bg-electric-blue/40 h-[40%] rounded-t-sm"></div>
            <div className="w-1/5 bg-electric-blue/60 h-[30%] rounded-t-sm"></div>
            <div className="w-1/5 bg-electric-teal h-[20%] rounded-t-sm relative shadow-[0_0_10px_rgba(20,184,166,0.3)]"></div>
          </div>
          <div className="absolute top-1/2 -right-16 px-3 py-1 glass-panel rounded-full text-[10px] text-electric-teal border-electric-teal/30 whitespace-nowrap bg-white">
            {t('landing.hero.mockup.slaLabel')}
          </div>
        </div>
      </div>
    </section>
  );
}
