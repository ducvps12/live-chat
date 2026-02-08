import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ProductFeatures() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('widget');

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { threshold: 0.1, rootMargin: '-20% 0px -50% 0px' });

    document.querySelectorAll('section[id]').forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // Offset for header (approx 140px)
      const y = element.getBoundingClientRect().top + window.scrollY - 140; 
      window.scrollTo({ top: y, behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  const navItemClass = (id: string) => `nav-link block text-sm font-medium py-2.5 pl-4 border-l-2 border-transparent transition-all rounded-r-lg cursor-pointer ${activeSection === id ? 'active text-blue-600 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`;

  // Helper to render check list items
  const renderList = (items: Record<string, string>, colorClass: string) => (
    <ul className="space-y-3 mb-8">
      {Object.values(items).map((item, idx) => (
        <li key={idx} className="flex items-start gap-3 text-gray-600">
          <span className={`material-symbols-outlined ${colorClass} mt-0.5`}>check_circle</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="max-w-[1280px] mx-auto px-6 pb-32 grid lg:grid-cols-12 gap-8 relative z-10 text-gray-900 mt-8 items-start">
      <aside className="hidden lg:block lg:col-span-3 sticky top-24 self-start max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar">
        <nav className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 px-4">{t('product.modules.title')}</div>
          <ul className="space-y-1">
            {['widget', 'inbox', 'routing', 'tracking', 'crm', 'reporting', 'rbac', 'api', 'billing', 'security'].map(key => (
               <li key={key}><a onClick={scrollTo(key)} className={navItemClass(key)}>{t(`product.modules.${key}`)}</a></li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="lg:col-span-9 flex flex-col gap-24">
        {/* Widget Section */}
        <section id="widget" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center group">
          <div>
            <div className="size-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 border border-blue-100">
              <span className="material-symbols-outlined text-2xl">chat_bubble</span>
            </div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">{t('product.features.widget.title')}</h2>
            <p className="text-xl text-gray-600 font-light leading-relaxed mb-6">
              {t('product.features.widget.subtitle')}
            </p>
            {renderList(t('product.features.widget.list', { returnObjects: true }) as Record<string, string>, 'text-blue-600')}
            <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-gray-50 p-2 rounded border border-gray-200 w-fit">
              <span className="material-symbols-outlined text-sm">code</span> {t('product.features.widget.setup')}
            </div>
          </div>
          <div className="relative">
             <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-4 min-h-[300px] flex items-center justify-center relative overlow-hidden">
                <div className="text-center">
                    <div className="size-16 bg-blue-100 rounded-full mx-auto mb-4 animate-pulse"></div>
                    <div className="h-4 bg-gray-100 rounded w-32 mx-auto mb-2"></div>
                    <div className="h-3 bg-gray-50 rounded w-24 mx-auto"></div>
                </div>
                {/* Simulated Widget */}
                <div className="absolute bottom-4 right-4 w-60 bg-white rounded-lg shadow-lg border border-gray-100 p-3">
                    <div className="flex gap-2 mb-2">
                        <div className="size-8 bg-blue-600 rounded-full"></div>
                        <div className="h-8 bg-gray-100 rounded flex-1"></div>
                    </div>
                </div>
             </div>
          </div>
        </section>

        {/* Inbox Section */}
        <section id="inbox" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center group">
          <div className="order-2 md:order-1 relative">
             <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-2 min-h-[300px] flex items-center justify-center">
                 <span className="material-symbols-outlined text-6xl text-purple-200">inbox</span>
             </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="size-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-6 border border-purple-100">
              <span className="material-symbols-outlined text-2xl">inbox</span>
            </div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">{t('product.features.inbox.title')}</h2>
            <p className="text-xl text-gray-600 font-light leading-relaxed mb-6">
              {t('product.features.inbox.subtitle')}
            </p>
            {renderList(t('product.features.inbox.list', { returnObjects: true }) as Record<string, string>, 'text-purple-600')}
          </div>
        </section>

        {/* Routing Section */}
        <section id="routing" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center group">
          <div>
            <div className="size-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-6 border border-teal-100">
              <span className="material-symbols-outlined text-2xl">alt_route</span>
            </div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">{t('product.features.routing.title')}</h2>
            <p className="text-xl text-gray-600 font-light leading-relaxed mb-6">
             {t('product.features.routing.subtitle')}
            </p>
            {renderList(t('product.features.routing.list', { returnObjects: true }) as Record<string, string>, 'text-teal-600')}
          </div>
          <div className="relative">
             <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                    <span className="font-bold text-gray-900">{t('product.features.routing.mockup.title')}</span>
                </div>
                {/* Mock Rules */}
                <div className="space-y-3">
                    <div className="bg-gray-50 p-3 rounded border border-gray-100 flex justify-between">
                        <div>
                            <div className="text-xs font-bold text-gray-700">{t('product.features.routing.mockup.sales')}</div>
                            <div className="text-[10px] text-gray-500">{t('product.features.routing.mockup.salesCond')}</div>
                        </div>
                        <div className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded h-fit">{t('product.features.routing.mockup.active')}</div>
                    </div>
                     <div className="bg-gray-50 p-3 rounded border border-gray-100 flex justify-between">
                        <div>
                            <div className="text-xs font-bold text-gray-700">{t('product.features.routing.mockup.tech')}</div>
                            <div className="text-[10px] text-gray-500">{t('product.features.routing.mockup.techCond')}</div>
                        </div>
                        <div className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded h-fit">{t('product.features.routing.mockup.active')}</div>
                    </div>
                </div>
             </div>
          </div>
        </section>

        {/* Tracking Section */}
        <section id="tracking" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1 relative">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                     <div className="flex items-center gap-4 mb-6">
                         <div className="size-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">V</div>
                         <div>
                             <div className="font-bold text-gray-900">Visitor #9822</div>
                             <div className="text-sm text-gray-500">{t('product.features.tracking.mockup.visiting')}</div>
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-2 rounded text-xs">
                            <div className="text-gray-400">{t('product.features.tracking.mockup.location')}</div>
                            <div className="font-medium">Vietnam</div>
                        </div>
                        <div className="bg-gray-50 p-2 rounded text-xs">
                            <div className="text-gray-400">{t('product.features.tracking.mockup.referrer')}</div>
                            <div className="font-medium">Google Ads</div>
                        </div>
                     </div>
                </div>
            </div>
            <div className="order-1 md:order-2">
                <div className="size-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-6 border border-orange-100">
                <span className="material-symbols-outlined text-2xl">visibility</span>
                </div>
                <h2 className="text-3xl font-bold mb-3 text-gray-900">{t('product.features.tracking.title')}</h2>
                <p className="text-xl text-gray-600 font-light leading-relaxed mb-6">
                 {t('product.features.tracking.subtitle')}
                </p>
                {renderList(t('product.features.tracking.list', { returnObjects: true }) as Record<string, string>, 'text-orange-500')}
            </div>
        </section>

        {/* Promo Section */}
        <section className="relative py-12 px-8 rounded-3xl overflow-hidden bg-white shadow-xl border border-blue-100">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent z-0"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('product.features.promo.title')}</h2>
              <p className="text-gray-600">{t('product.features.promo.subtitle')}</p>
            </div>
            <div className="flex gap-4">
              <button className="h-10 px-6 bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold rounded-full transition-colors shadow-lg shadow-blue-500/30">{t('product.features.promo.ctaPrimary')}</button>
              <button className="h-10 px-6 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-full transition-colors">{t('product.features.promo.ctaSecondary')}</button>
            </div>
          </div>
        </section>

        {/* CRM Section */}
        <section id="crm" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="size-12 rounded-xl bg-pink-50 flex items-center justify-center text-pink-500 mb-6 border border-pink-100">
              <span className="material-symbols-outlined text-2xl">contacts</span>
            </div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">{t('product.features.crm.title')}</h2>
            <p className="text-xl text-gray-600 font-light leading-relaxed mb-6">
              {t('product.features.crm.subtitle')}
            </p>
            {renderList(t('product.features.crm.list', { returnObjects: true }) as Record<string, string>, 'text-pink-500')}
          </div>
           <div className="relative">
             <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="size-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold">JD</div>
                    <div>
                        <div className="font-bold text-gray-900">John Doe</div>
                        <div className="text-sm text-gray-500">john@example.com</div>
                    </div>
                    <div className="ml-auto bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">{t('product.features.crm.mockup.qualified')}</div>
                </div>
             </div>
           </div>
        </section>

        {/* Reporting Section */}
        <section id="reporting" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1 relative">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase mb-2">{t('product.features.reporting.mockup.frt')}</div>
                    <div className="text-3xl font-bold text-gray-900 mb-6">1m 24s</div>
                    <div className="h-32 flex items-end gap-2">
                        {[40, 70, 50, 90, 60, 80, 40].map((h, i) => (
                            <div key={i} style={{height: `${h}%`}} className="flex-1 bg-blue-500/20 rounded-t hover:bg-blue-500 transition-colors"></div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="order-1 md:order-2">
                <div className="size-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-6 border border-indigo-100">
                <span className="material-symbols-outlined text-2xl">bar_chart</span>
                </div>
                <h2 className="text-3xl font-bold mb-3 text-gray-900">{t('product.features.reporting.title')}</h2>
                <p className="text-xl text-gray-600 font-light leading-relaxed mb-6">
                 {t('product.features.reporting.subtitle')}
                </p>
                {renderList(t('product.features.reporting.list', { returnObjects: true }) as Record<string, string>, 'text-indigo-500')}
            </div>
        </section>

         {/* RBAC Section */}
         <section id="rbac" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center">
            <div>
                 <h2 className="text-2xl font-bold mb-3 text-gray-900">{t('product.features.rbac.title')}</h2>
                 <p className="text-lg text-gray-600 mb-4">{t('product.features.rbac.subtitle')}</p>
                 {renderList(t('product.features.rbac.list', { returnObjects: true }) as Record<string, string>, 'text-gray-500')}
            </div>
            <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-l-red-500 border-y border-r border-gray-100">
                 <div className="font-mono text-xs text-gray-500 mb-2">{t('product.features.rbac.mockup.title')}</div>
                 <div className="text-sm text-gray-900 mb-1"><span className="text-red-600 font-medium">User[Admin]</span> {t('product.features.rbac.mockup.accessed')} <span className="text-blue-600 font-medium">Contact[#992]</span></div>
            </div>
         </section>
        
         {/* API Section */}
         <section id="api" className="scroll-mt-32 grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1 bg-white p-4 rounded-xl shadow-md border border-gray-100">
                 <div className="font-mono text-xs text-green-600 mb-2">POST /v1/webhooks/chat_started</div>
                 <div className="bg-slate-900 p-3 rounded text-[10px] text-slate-300 font-mono leading-relaxed overflow-x-auto">
                    {`{"event": "chat.started", "data": { "visitor_id": "v_123" }}`}
                 </div>
            </div>
            <div className="order-1 md:order-2">
                 <h2 className="text-2xl font-bold mb-3 text-gray-900">{t('product.features.api.title')}</h2>
                 <p className="text-lg text-gray-600 mb-4">{t('product.features.api.subtitle')}</p>
                 {renderList(t('product.features.api.list', { returnObjects: true }) as Record<string, string>, 'text-gray-500')}
            </div>
         </section>

         {/* Billing & Security */}
         <div className="grid md:grid-cols-2 gap-12">
            <section id="billing" className="scroll-mt-32">
                 <h2 className="text-2xl font-bold mb-3 text-gray-900">{t('product.features.billing.title')}</h2>
                 <p className="text-lg text-gray-600 mb-4">{t('product.features.billing.subtitle')}</p>
                 {renderList(t('product.features.billing.list', { returnObjects: true }) as Record<string, string>, 'text-gray-500')}
            </section>
             <section id="security" className="scroll-mt-32">
                 <h2 className="text-2xl font-bold mb-3 text-gray-900">{t('product.features.security.title')}</h2>
                 <p className="text-lg text-gray-600 mb-4">{t('product.features.security.subtitle')}</p>
                 {renderList(t('product.features.security.list', { returnObjects: true }) as Record<string, string>, 'text-gray-500')}
            </section>
         </div>

      </main>
    </div>
  );
}
