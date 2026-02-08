import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function ProductCTA() {
  const { t } = useTranslation();

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 tracking-tight font-display">
          {t('product.cta.title')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-purple-500 to-electric-teal animate-gradient-x">
            {t('product.cta.titleBreak')}
          </span>
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('product.cta.subtitle')}
        </p>
        <div className="flex flex-col items-center gap-4">
          <button className="relative overflow-hidden group h-14 px-10 bg-electric-blue text-white rounded-full font-bold text-lg transition-all hover:shadow-[0_0_30px_rgba(13,166,242,0.4)] active:scale-95">
            <span className="relative z-10 flex items-center gap-2">
               {t('product.cta.button')}
               <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </span>
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          </button>
          <p className="text-sm text-gray-500">
            {t('product.cta.disclaimer')}
          </p>
        </div>
      </div>
    </section>
  );
}

const FAQItem = ({ id, question, answer }: { id: string; question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = `faq-content-${id}`;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white transition-all hover:border-electric-blue/30 hover:shadow-sm">
      <button 
        className="flex justify-between items-center font-bold cursor-pointer w-full p-5 text-left text-gray-900 hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen ? "true" : "false"}
        aria-controls={contentId}
      >
        <span className="text-base lg:text-lg">{question}</span>
        <span className={`transition-transform duration-300 transform ${isOpen ? 'rotate-180 text-electric-blue' : 'text-gray-400'}`}>
          <span className="material-symbols-outlined">expand_more</span>
        </span>
      </button>
      <div 
        id={contentId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
           <div className="p-5 pt-0 text-gray-600 leading-relaxed border-t border-transparent">
             {answer}
           </div>
        </div>
      </div>
    </div>
  );
};

export function ProductFAQ() {
  const { t } = useTranslation();
  const faqItems = t('product.faq.items', { returnObjects: true }) as Record<string, { question: string, answer: string }>;

  return (
    <section className="py-24 bg-gray-50 border-t border-gray-200">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          {t('product.faq.title')}
        </h2>
        <div className="space-y-4">
            {Object.entries(faqItems).map(([key, item]) => (
                <FAQItem key={key} id={key} question={item.question} answer={item.answer} />
            ))}
        </div>
      </div>
    </section>
  );
}
