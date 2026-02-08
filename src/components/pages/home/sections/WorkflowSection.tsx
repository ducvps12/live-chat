import { useTranslation } from 'react-i18next';

export default function WorkflowSection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-gray-900 mb-4">
            {t('landing.workflow.title')}
          </h2>
          <p className="text-gray-600">{t('landing.workflow.subtitle')}</p>
        </div>
        <div className="space-y-24">
          {/* Step 1: ENGAGE */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 order-2 md:order-1 relative h-64 w-full">
              <div className="absolute inset-0 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xl">
                <div className="p-4 space-y-2">
                  <div className="h-2 w-full bg-gray-100 rounded"></div>
                  <div className="h-24 w-full bg-gray-50 rounded border border-gray-100"></div>
                  <div className="flex gap-2">
                    <div className="h-20 w-1/3 bg-gray-50 rounded border border-gray-100"></div>
                    <div className="h-20 w-1/3 bg-gray-50 rounded border border-gray-100"></div>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 bg-electric-blue text-white p-3 rounded-xl rounded-br-sm w-48 shadow-lg">
                  <p className="text-xs font-bold">{t('landing.workflow.steps.engage.mockupText')}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 order-1 md:order-2 space-y-4">
              <div className="text-electric-blue font-mono text-sm">{t('landing.workflow.steps.engage.label')}</div>
              <h3 className="text-2xl font-bold text-gray-900">{t('landing.workflow.steps.engage.title')}</h3>
              <p className="text-gray-600">{t('landing.workflow.steps.engage.description')}</p>
            </div>
          </div>

          {/* Step 2: CAPTURE */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-4">
              <div className="text-electric-purple font-mono text-sm">{t('landing.workflow.steps.capture.label')}</div>
              <h3 className="text-2xl font-bold text-gray-900">{t('landing.workflow.steps.capture.title')}</h3>
              <p className="text-gray-600">{t('landing.workflow.steps.capture.description')}</p>
            </div>
            <div className="flex-1 relative h-64 w-full">
              <div className="absolute inset-0 glass-panel rounded-xl flex items-center justify-center p-8 bg-white border-gray-200">
                <div className="w-full max-w-sm space-y-3">
                  <div className="h-10 bg-gray-50 border border-gray-200 rounded px-3 flex items-center text-sm text-gray-500">
                    {t('landing.workflow.steps.capture.formName')}
                  </div>
                  <div className="h-10 bg-gray-50 border border-gray-200 rounded px-3 flex items-center text-sm text-gray-500">
                    {t('landing.workflow.steps.capture.formPhone')}
                  </div>
                  <button className="w-full h-10 bg-electric-blue rounded text-white text-sm font-bold shadow-lg shadow-electric-blue/20">
                    {t('landing.workflow.steps.capture.formButton')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: CLOSE */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 order-2 md:order-1 relative h-64 w-full">
              <div className="absolute inset-0 glass-panel-heavy rounded-xl border border-electric-teal/30 flex flex-col p-4 bg-white shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-slate-700"></div>
                  <div>
                    <div className="h-3 w-32 bg-gray-200 rounded mb-1"></div>
                    <div className="flex gap-1">
                      <span className="px-1 bg-electric-teal/10 text-electric-teal text-[10px] rounded font-medium">
                        {t('landing.workflow.steps.close.tagQualified')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-gray-50 rounded border border-gray-100 p-2">
                  <div className="text-[10px] text-gray-500 mb-1">{t('landing.workflow.steps.close.noteLabel')}</div>
                  <p className="text-xs text-gray-600">{t('landing.workflow.steps.close.noteText')}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 order-1 md:order-2 space-y-4">
              <div className="text-electric-teal font-mono text-sm">{t('landing.workflow.steps.close.label')}</div>
              <h3 className="text-2xl font-bold text-gray-900">{t('landing.workflow.steps.close.title')}</h3>
              <p className="text-gray-600">{t('landing.workflow.steps.close.description')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
