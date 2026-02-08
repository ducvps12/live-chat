import { useTranslation } from 'react-i18next';

export default function SecurityBanner() {
    const { t } = useTranslation();

    const features = [
        { icon: 'admin_panel_settings', label: t('pricing.security.rbac', 'RBAC theo scope') },
        { icon: 'history_edu', label: t('pricing.security.audit', 'Audit log') },
        { icon: 'cloud_done', label: t('pricing.security.retention', 'Retention theo plan') },
        { icon: 'lock', label: t('pricing.security.export', 'Export kiểm soát quyền') },
        { icon: 'api', label: t('pricing.security.api', 'API/Webhooks') },
    ];

    return (
        <section className="border-y border-gray-200 bg-gray-50 relative z-10">
            <div className="max-w-[1280px] mx-auto px-6 py-8 flex flex-wrap justify-center lg:justify-between items-center gap-6">
                <div className="flex flex-wrap justify-center gap-6 md:gap-8">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-2 text-sm text-gray-600 font-medium"
                        >
                            <span className="material-symbols-outlined text-electric-blue text-lg">
                                {feature.icon}
                            </span>
                            {feature.label}
                        </div>
                    ))}
                </div>
                <div>
                    <a
                        href="#"
                        className="text-sm font-bold text-electric-blue hover:text-electric-blue/80 transition-colors flex items-center gap-1"
                    >
                        {t('pricing.security.learnMore', 'Xem chi tiết bảo mật')}
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </a>
                </div>
            </div>
        </section>
    );
}
