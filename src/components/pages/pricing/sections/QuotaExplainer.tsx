import { useTranslation } from 'react-i18next';

export default function QuotaExplainer() {
    const { t } = useTranslation();

    const quotaItems = [
        {
            label: 'Agent',
            icon: 'person',
            description: t('pricing.quota.agent', 'Số lượng nhân viên được truy cập vào hệ thống đồng thời.'),
        },
        {
            label: 'Conversation',
            icon: 'chat',
            description: t('pricing.quota.conversation', 'Số cuộc hội thoại mới được tạo ra mỗi tháng.'),
        },
        {
            label: 'Retention',
            icon: 'history',
            description: t('pricing.quota.retention', 'Thời gian tin nhắn được lưu trữ và có thể tìm kiếm lại.'),
        },
    ];

    return (
        <section className="py-12 px-6">
            <div className="max-w-[1000px] mx-auto bg-gradient-to-r from-electric-blue/5 to-purple-500/5 p-8 rounded-2xl border border-electric-blue/10 relative overflow-hidden">
                {/* Glow effect */}
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-electric-blue/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    {/* Left content */}
                    <div className="md:w-1/3">
                        <h2 className="text-2xl font-bold mb-3 text-gray-900">
                            {t('pricing.quota.title', 'Quota được tính như thế nào?')}
                        </h2>
                        <p className="text-gray-600 text-sm mb-4">
                            {t('pricing.quota.subtitle', 'Mọi giới hạn đều minh bạch. Bạn luôn thấy mức sử dụng hiện tại (Usage) ngay trong cài đặt workspace.')}
                        </p>
                        <div className="flex items-center gap-2 text-xs font-bold text-electric-blue">
                            <span className="material-symbols-outlined text-base">visibility</span>
                            {t('pricing.quota.visibility', 'Bạn luôn thấy usage hiện tại trong app')}
                        </div>
                    </div>

                    {/* Right - Cards */}
                    <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                        {quotaItems.map((item) => (
                            <div
                                key={item.label}
                                className="bg-white p-4 rounded-xl border border-gray-200 text-center shadow-sm"
                            >
                                <div className="text-gray-500 text-xs font-bold uppercase mb-2">
                                    {item.label}
                                </div>
                                <span className="material-symbols-outlined text-3xl text-gray-700 mb-2">
                                    {item.icon}
                                </span>
                                <p className="text-xs text-gray-500">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
