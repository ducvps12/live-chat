import { useTranslation } from 'react-i18next';
import { useState } from 'react';

interface FeatureRow {
    name: string;
    tooltip?: string;
    starter: string;
    growth: string;
    enterprise: string;
}

interface FeatureCategory {
    title: string;
    features: FeatureRow[];
}

export default function FeatureComparison() {
    const { t } = useTranslation();

    const categories: FeatureCategory[] = [
        {
            title: 'Live Chat Widget',
            features: [
                { name: 'Custom Branding (Logo, Color)', starter: 'Có', growth: 'Có', enterprise: 'Có' },
                { name: 'Pre-chat Form', tooltip: 'Thu thập thông tin khách trước khi chat', starter: 'Cơ bản', growth: 'Nâng cao', enterprise: 'Custom Fields' },
                { name: 'Remove Branding', starter: '-', growth: 'Có', enterprise: 'Có' },
            ],
        },
        {
            title: 'Inbox & Collaboration',
            features: [
                { name: 'Omnichannel (FB, Zalo, Web)', starter: 'Có', growth: 'Có', enterprise: 'Có' },
                { name: 'Private Note (Ghi chú nội bộ)', starter: 'Có', growth: 'Có', enterprise: 'Có' },
                { name: 'Saved Replies (Câu trả lời mẫu)', starter: '10', growth: 'Không giới hạn', enterprise: 'Không giới hạn' },
            ],
        },
        {
            title: 'Routing & SLA',
            features: [
                { name: 'Auto-assign (Tự động chia chat)', starter: '-', growth: 'Round Robin', enterprise: 'Skill-based' },
                { name: 'SLA Rules & Reporting', starter: '-', growth: 'Cơ bản', enterprise: 'Nâng cao' },
            ],
        },
        {
            title: 'Reporting & Export',
            features: [
                { name: 'Dashboard tổng quan', starter: 'Có', growth: 'Có', enterprise: 'Có' },
                { name: 'Export dữ liệu (CSV/Excel)', starter: '30 ngày', growth: '1 năm', enterprise: 'Full History' },
            ],
        },
        {
            title: 'RBAC & Security',
            features: [
                { name: 'Quyền truy cập (Scope)', starter: 'Admin/Member', growth: 'Custom Roles', enterprise: 'Granular Scope' },
                { name: 'Audit Logs', starter: '-', growth: '90 ngày', enterprise: 'Trọn đời' },
            ],
        },
    ];

    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        'Live Chat Widget': true,
        'Inbox & Collaboration': true,
    });

    const toggleCategory = (title: string) => {
        setOpenCategories((prev) => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <section className="py-16 px-6">
            <div className="max-w-[1200px] mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        {t('pricing.comparison.title', 'So sánh chi tiết tính năng')}
                    </h2>
                    <p className="text-gray-600">
                        {t('pricing.comparison.subtitle', 'Đi sâu vào từng chi tiết để chọn đúng công cụ.')}
                    </p>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
                    {/* Table header - Desktop */}
                    <div className="hidden md:grid grid-cols-4 bg-gray-50 p-5 sticky top-20 z-30 border-b border-gray-200">
                        <div className="font-bold text-gray-600">
                            {t('pricing.comparison.feature', 'Tính năng')}
                        </div>
                        <div className="font-bold text-gray-900 text-center">Starter</div>
                        <div className="font-bold text-electric-blue text-center">Growth</div>
                        <div className="font-bold text-gray-900 text-center">Pro / Enterprise</div>
                    </div>

                    {/* Categories */}
                    {categories.map((category) => (
                        <details
                            key={category.title}
                            className="group border-b border-gray-100"
                            open={openCategories[category.title]}
                        >
                            <summary
                                onClick={(e) => {
                                    e.preventDefault();
                                    toggleCategory(category.title);
                                }}
                                className="p-5 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between font-bold text-gray-900"
                            >
                                <span>{category.title}</span>
                                <span
                                    className={`material-symbols-outlined transition-transform text-gray-500 ${openCategories[category.title] ? 'rotate-180' : ''
                                        }`}
                                >
                                    expand_more
                                </span>
                            </summary>

                            {/* Feature rows */}
                            {openCategories[category.title] &&
                                category.features.map((feature, idx) => (
                                    <div
                                        key={idx}
                                        className="grid grid-cols-1 md:grid-cols-4 p-5 gap-4 md:gap-0 hover:bg-gray-50 border-b border-gray-100 items-center"
                                    >
                                        <div className="text-gray-700 font-medium pl-4 flex items-center gap-2">
                                            {feature.name}
                                            {feature.tooltip && (
                                                <span
                                                    className="material-symbols-outlined text-gray-400 text-sm cursor-help"
                                                    title={feature.tooltip}
                                                >
                                                    help
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-center text-sm text-gray-600">
                                            <span className="md:hidden font-bold mr-2 text-gray-400">Starter:</span>
                                            {feature.starter}
                                        </div>
                                        <div className="text-center text-sm text-electric-blue font-bold">
                                            <span className="md:hidden font-bold mr-2 text-gray-400">Growth:</span>
                                            {feature.growth}
                                        </div>
                                        <div className="text-center text-sm text-gray-700">
                                            <span className="md:hidden font-bold mr-2 text-gray-400">Pro:</span>
                                            {feature.enterprise}
                                        </div>
                                    </div>
                                ))}
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
