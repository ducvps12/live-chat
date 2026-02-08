import { useTranslation } from 'react-i18next';

export default function ProductHero() {
  const { t } = useTranslation();

  return (
    <section className="relative z-10 pt-32 pb-16 lg:pt-40 lg:pb-32 max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 lg:gap-8 items-center min-h-[90vh]">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-white before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-full before:h-full before:bg-[radial-gradient(circle_at_50%_0%,_rgba(13,166,242,0.05),transparent_70%)] -z-10"></div>

      {/* Left Column - Content */}
      <div className="lg:col-span-6 flex flex-col gap-8 relative text-center lg:text-left items-center lg:items-start">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-electric-blue/30 bg-electric-blue/5 w-fit animate-fade-in-up">
          <span className="w-1.5 h-1.5 rounded-full bg-electric-blue animate-pulse"></span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-electric-blue">
            {t('product.hero.badge')}
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display font-bold text-5xl lg:text-7xl leading-[1.1] text-gray-900 tracking-tight animate-fade-in-up delay-100">
          {t('product.hero.title')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-purple-500 to-electric-teal animate-gradient-x">
            {t('product.hero.titleHighlight')}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-gray-600 leading-relaxed max-w-xl animate-fade-in-up delay-200">
          {t('product.hero.subtitle')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 animate-fade-in-up delay-300">
          <button className="relative overflow-hidden rounded-full bg-electric-blue text-white px-8 py-4 font-bold text-base transition-all hover:shadow-[0_0_30px_rgba(13,166,242,0.4)] active:scale-95 group">
            <span className="relative z-10 flex items-center gap-2">
              {t('product.hero.ctaPrimary')}
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
            {t('product.hero.ctaSecondary')}
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="flex flex-wrap justify-center lg:justify-start items-center gap-y-2 gap-x-6 text-xs text-gray-500 mt-6 font-mono animate-fade-in-up delay-500">
           {[
                { label: t('product.hero.features.noCard') },
                { label: 'Setup 5 phút' }, 
                { label: 'Hỗ trợ cài đặt' },
            ].map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-electric-teal">check</span>
                    {item.label}
                </span>
            ))}
        </div>

        {/* Enterprise Badge */}
        <div className="pt-8 border-t border-gray-100 mt-8 flex items-center gap-6 opacity-80 hover:opacity-100 transition-all duration-500 animate-fade-in-up delay-700 justify-center lg:justify-start w-full">
          <div className="flex flex-col gap-1 items-start">
            <div className="flex gap-1 text-electric-blue">
              <span className="material-symbols-outlined text-[16px]">security</span>
              <span className="material-symbols-outlined text-[16px]">lock</span>
              <span className="material-symbols-outlined text-[16px]">api</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-700">
              ENTERPRISE READY
            </span>
          </div>
          <div className="h-8 w-[1px] bg-gray-200"></div>
          <div className="text-[10px] text-gray-500 flex flex-col items-start gap-0.5">
             <span className="whitespace-nowrap">RBAC • Audit Log</span>
             <span className="whitespace-nowrap">API/Webhooks</span>
          </div>
        </div>
      </div>

      {/* Right Column - Visual/Mockup */}
      <div className="lg:col-span-6 relative perspective-1000 animate-fade-in-up delay-500 mt-10 lg:mt-0 select-none">
         {/* Beam Line Effect */}
         <div className="absolute top-[60%] left-[20%] right-[30%] h-[2px] bg-gradient-to-r from-electric-blue/50 to-electric-purple/50 z-0">
            <div className="absolute top-0 left-0 w-20 h-full bg-white blur-[2px] animate-beam-flow"></div>
         </div>

         <div className="relative rounded-2xl p-2 glass-panel border-glow transform lg:rotate-y-12 transition-transform hover:scale-[1.02] duration-500 bg-white">
             {/* Simple visual representation of a dashboard/chat interface */}
             <div className="rounded-xl overflow-hidden bg-white aspect-[16/9] relative group shadow-sm flex flex-col">
                {/* Fake Header */}
                <div className="h-10 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-4 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-red-400"></div>
                    <div className="size-2.5 rounded-full bg-yellow-400"></div>
                    <div className="size-2.5 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-[150px]"></div>
                  <div className="ml-auto">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium border border-green-200 flex items-center gap-1">
                          <span className="size-1 bg-green-500 rounded-full animate-pulse"></span>
                          Realtime
                      </span>
                  </div>
                </div>
                {/* Content Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar */}
                     <div className="w-1/4 border-r border-gray-100 p-3 space-y-2 hidden sm:block bg-white">
                        <div className="bg-white border border-electric-blue/30 shadow-sm p-2 rounded-lg text-[10px] mb-2 text-center text-electric-blue font-medium">Inbox hợp nhất</div>
                        <div className="h-6 bg-gray-50 rounded w-full"></div>
                        <div className="h-6 bg-gray-50 rounded w-full"></div>
                     </div>
                     
                    {/* Main Area */}
                    <div className="flex-1 p-4 bg-gray-50/30 relative flex flex-col">
                         <div className="space-y-3 flex-1">
                             {/* Msg 1 */}
                             <div className="flex flex-col items-end gap-1">
                                 <div className="glass-panel p-2 rounded-lg rounded-br-none text-xs border-electric-blue/20 max-w-[80%] bg-white">
                                     <div className="h-1.5 w-24 bg-electric-blue/20 rounded mb-1"></div>
                                     <div className="h-1.5 w-16 bg-electric-blue/20 rounded"></div>
                                 </div>
                             </div>
                              {/* Msg 2 */}
                             <div className="flex flex-col items-start gap-1">
                                 <div className="bg-white p-2 rounded-lg rounded-bl-none text-xs border border-gray-200 shadow-sm max-w-[80%]">
                                      <div className="h-1.5 w-32 bg-gray-100 rounded"></div>
                                 </div>
                             </div>
                         </div>
                         
                         {/* Reply Box */}
                         <div className="mt-auto bg-white border border-gray-200 rounded-lg p-2 text-[10px] text-gray-400 shadow-sm">
                             Reply...
                         </div>
                    </div>
                    
                    {/* Right Panel */}
                    <div className="w-1/4 border-l border-gray-100 p-2 space-y-2 hidden sm:flex flex-col items-center bg-white">
                         <div className="size-8 rounded-full bg-purple-100 mx-auto"></div>
                         <div className="text-[8px] text-gray-400 font-bold mt-2">SOURCE</div>
                         <div className="px-1 py-0.5 bg-yellow-50 text-yellow-600 text-[8px] rounded border border-yellow-200 text-center font-bold w-full">UTM: Ads</div>
                         <div className="px-1 py-0.5 bg-purple-50 text-purple-600 text-[8px] rounded border border-purple-200 text-center font-bold w-full">Qualified</div>
                    </div>
                </div>
                
                {/* Floating Labels (Outside/Overlaid) */}
                <div className="absolute top-24 left-8 hidden lg:block animate-float">
                    <div className="glass-panel px-3 py-1 rounded-full text-[10px] text-electric-purple border-electric-purple/30 bg-white/90 backdrop-blur-sm shadow-sm">Inbox hợp nhất</div>
                </div>
                
                <div className="absolute bottom-16 left-[-10px] hidden lg:block animate-float" style={{animationDelay: '1s'}}>
                     <div className="glass-panel px-3 py-1 rounded-full text-[10px] text-electric-blue border-electric-blue/30 bg-white/90 backdrop-blur-sm shadow-sm">Widget đẹp & nhanh</div>
                </div>
             </div>
          </div>
          
          {/* SLA Widget Floating */}
          <div className="absolute -bottom-6 -right-4 glass-panel p-3 rounded-xl z-20 animate-float hidden lg:block shadow-lg bg-white/95" style={{animationDelay: '2s'}}>
               <div className="flex justify-between items-center text-[10px] mb-2 gap-4">
                   <span className="text-gray-500 font-medium">Response Time</span>
                   <span className="text-green-600 font-bold flex items-center">▼ 45%</span>
               </div>
               <div className="flex items-end gap-1 h-10 w-32">
                    <div className="flex-1 bg-electric-blue/20 h-full rounded-t-sm"></div>
                    <div className="flex-1 bg-electric-blue/30 h-[80%] rounded-t-sm"></div>
                    <div className="flex-1 bg-electric-blue/40 h-[50%] rounded-t-sm"></div>
                    <div className="flex-1 bg-electric-teal h-[30%] rounded-t-sm shadow-[0_0_10px_rgba(20,184,166,0.3)]"></div>
               </div>
                <div className="absolute top-1/2 -right-3 translate-x-1/2 px-2 py-0.5 glass-panel rounded-full text-[8px] text-electric-teal border-electric-teal/30 bg-white shadow-sm">
                    SLA Report
                </div>
          </div>

          {/* Decorative glow behind */}
          <div className="absolute -inset-10 bg-gradient-to-r from-electric-blue to-electric-purple opacity-20 blur-3xl -z-10 rounded-[30px]"></div>
      </div>
    </section>
  );
}
