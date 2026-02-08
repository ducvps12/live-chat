import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export default function CTASection() {
    const { t } = useTranslation();

    return (
        <section className="py-24 px-6 relative z-10 overflow-hidden bg-gradient-to-b from-white to-electric-blue/5">
            <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight text-gray-900">
                    {t('pricing.cta.title', 'Bắt đầu thu lead từ live chat')}{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-purple-500">
                        {t('pricing.cta.titleHighlight', 'ngay hôm nay.')}
                    </span>
                </h2>

                <div className="flex flex-wrap justify-center gap-3 text-gray-500 text-lg mb-10 font-medium">
                    <span>Widget xịn</span>
                    <span className="text-gray-300">•</span>
                    <span>Inbox rõ</span>
                    <span className="text-gray-300">•</span>
                    <span>CRM-lite</span>
                    <span className="text-gray-300">•</span>
                    <span>SLA report</span>
                </div>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link
                        href="/auth/register"
                        className="h-14 px-10 bg-electric-blue hover:bg-electric-blue/90 text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center"
                    >
                        {t('pricing.cta.primary', 'Dùng thử miễn phí')}
                    </Link>
                    <button className="h-14 px-10 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-lg font-bold rounded-full transition-all">
                        {t('pricing.cta.secondary', 'Liên hệ sales')}
                    </button>
                </div>

                <p className="text-sm text-gray-500 mt-6">
                    {t('pricing.cta.subtitle', 'Setup trong 2 phút • Hỗ trợ tiếng Việt 100%')}
                </p>
            </div>
        </section>
    );
}
