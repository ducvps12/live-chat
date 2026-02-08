import { useTranslation } from 'react-i18next';
import Link from 'next/link';

interface PricingCardsProps {
    isYearly: boolean;
}

interface PlanFeature {
    text: string;
    included: boolean;
}

interface PricingPlan {
    name: string;
    description: string;
    price: string;
    priceUnit: string;
    tags: string[];
    features: PlanFeature[];
    isPopular?: boolean;
    isEnterprise?: boolean;
    highlightFeatures?: { icon: string; label: string }[];
    enterpriseFeatures?: { icon: string; label: string }[];
}

export default function PricingCards({ isYearly }: PricingCardsProps) {
    const { t } = useTranslation();

    const plans: PricingPlan[] = [
        {
            name: 'Starter',
            description: t('pricing.plans.starter.desc', 'Dành cho cá nhân & team nhỏ.'),
            price: '$0',
            priceUnit: t('pricing.plans.starter.unit', '/tháng'),
            tags: ['2 Agents', '500 Chats', '30 ngày lưu trữ', '1 Widget'],
            features: [
                { text: t('pricing.features.basicWidget', 'Live Chat Widget cơ bản'), included: true },
                { text: t('pricing.features.unifiedInbox', 'Inbox gộp (FB, Zalo)'), included: true },
                { text: t('pricing.features.apps', 'Desktop & Mobile App'), included: true },
                { text: t('pricing.features.emailSupport', 'Email Support'), included: true },
            ],
        },
        {
            name: 'Growth',
            description: t('pricing.plans.growth.desc', 'Dành cho startup đang tăng trưởng.'),
            price: isYearly ? '$23' : '$29',
            priceUnit: t('pricing.plans.growth.unit', '/agent/tháng'),
            tags: ['5 Agents', 'Unlimited Chats', '1 năm lưu trữ', '3 Widgets'],
            isPopular: true,
            highlightFeatures: [
                { icon: 'smart_toy', label: 'Auto-assign' },
                { icon: 'speed', label: 'SLA Metrics' },
                { icon: 'file_download', label: 'Export' },
            ],
            features: [
                { text: t('pricing.features.allStarter', 'Mọi tính năng Starter'), included: true },
                { text: t('pricing.features.automation', 'Automation Rules & Workflows'), included: true },
                { text: t('pricing.features.advancedReports', 'Báo cáo nâng cao & Team performance'), included: true },
                { text: t('pricing.features.chatSupport', 'Chat Support 24/7'), included: true },
            ],
        },
        {
            name: 'Pro / Enterprise',
            description: t('pricing.plans.enterprise.desc', 'Bảo mật & quản trị cấp cao.'),
            price: t('pricing.plans.enterprise.price', 'Liên hệ'),
            priceUnit: '',
            tags: ['Unlimited Agents', 'Unlimited Retention', 'Custom Widgets'],
            isEnterprise: true,
            enterpriseFeatures: [
                { icon: 'security', label: 'RBAC Scope nâng cao' },
                { icon: 'history', label: 'Audit logs trọn đời' },
                { icon: 'verified_user', label: 'Compliance / On-premise' },
            ],
            features: [
                { text: t('pricing.features.allGrowth', 'Mọi tính năng Growth'), included: true },
                { text: t('pricing.features.successManager', 'Dedicated Success Manager'), included: true },
                { text: t('pricing.features.sla', 'SLA uptime 99.99%'), included: true },
                { text: t('pricing.features.apiLimit', 'API Rate Limit tùy chỉnh'), included: true },
            ],
        },
    ];

    return (
        <section className="relative z-20 px-6 pb-24">
            <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan, index) => (
                    <div
                        key={plan.name}
                        className={`rounded-2xl p-8 flex flex-col relative transition-all duration-300 ${plan.isPopular
                                ? 'bg-white shadow-2xl border-2 border-electric-blue transform md:-translate-y-4 z-10'
                                : 'bg-white shadow-lg border border-gray-200 hover:shadow-xl hover:-translate-y-1'
                            }`}
                        style={{ animationDelay: `${(index + 1) * 100}ms` }}
                    >
                        {/* Popular badge */}
                        {plan.isPopular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-electric-blue to-purple-500 px-4 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider shadow-lg">
                                {t('pricing.popularBadge', 'Phổ biến nhất')}
                            </div>
                        )}

                        {/* Plan header */}
                        <div className={`mb-6 ${plan.isPopular ? 'mt-2' : ''}`}>
                            <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                                {plan.name}
                                {plan.isPopular && (
                                    <span className="material-symbols-outlined text-purple-500 text-lg animate-pulse">bolt</span>
                                )}
                            </h3>
                            <p className="text-gray-500 text-sm">{plan.description}</p>
                        </div>

                        {/* Price */}
                        <div className="mb-6">
                            <div className="flex items-end gap-1">
                                <span className={`text-4xl font-bold ${plan.isPopular ? 'text-electric-blue' : 'text-gray-900'}`}>
                                    {plan.price}
                                </span>
                                {plan.priceUnit && <span className="text-gray-500 mb-1">{plan.priceUnit}</span>}
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mb-8">
                            {plan.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className={`px-3 py-1 rounded-full text-xs font-bold ${plan.isPopular
                                            ? 'bg-electric-blue/10 border border-electric-blue/30 text-electric-blue'
                                            : 'bg-gray-100 border border-gray-200 text-gray-600'
                                        }`}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>

                        {/* Highlight features (Growth plan) */}
                        {plan.highlightFeatures && (
                            <div className="bg-gradient-to-r from-electric-blue/5 to-purple-500/5 rounded-lg p-4 mb-6 border border-electric-blue/10">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-3">
                                    {t('pricing.worthIt', 'Tính năng đáng tiền:')}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {plan.highlightFeatures.map((feature, idx) => (
                                        <div key={idx} className="text-center">
                                            <span
                                                className={`material-symbols-outlined mb-1 ${idx === 0 ? 'text-purple-500' : idx === 1 ? 'text-electric-teal' : 'text-electric-blue'
                                                    }`}
                                            >
                                                {feature.icon}
                                            </span>
                                            <p className="text-[10px] leading-tight text-gray-700 font-medium">{feature.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Enterprise features */}
                        {plan.enterpriseFeatures && (
                            <div className="mb-6 space-y-2">
                                {plan.enterpriseFeatures.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs font-bold text-purple-600">
                                        <span className="material-symbols-outlined text-sm">{feature.icon}</span>
                                        {feature.label}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Features list */}
                        <ul className="space-y-4 mb-8 flex-grow">
                            {plan.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm text-gray-600">
                                    <span className={`material-symbols-outlined text-lg ${plan.isPopular ? 'text-electric-teal' : 'text-electric-blue'}`}>
                                        check_circle
                                    </span>
                                    <span>{feature.text}</span>
                                </li>
                            ))}
                        </ul>

                        {/* CTA Button */}
                        {plan.isEnterprise ? (
                            <>
                                <button className="w-full h-12 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold rounded-lg transition-all mb-3">
                                    {t('pricing.cta.contactSales', 'Liên hệ Sales')}
                                </button>
                                <p className="text-center text-xs text-gray-500">
                                    {t('pricing.enterprise.subtitle', 'Demo theo use-case + tư vấn triển khai')}
                                </p>
                            </>
                        ) : (
                            <Link
                                href="/auth/register"
                                className={`w-full h-12 font-bold rounded-lg transition-all flex items-center justify-center ${plan.isPopular
                                        ? 'bg-electric-blue hover:bg-electric-blue/90 text-white shadow-lg hover:shadow-xl'
                                        : 'bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700'
                                    }`}
                            >
                                {t('pricing.cta.startTrial', 'Bắt đầu dùng thử')}
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
