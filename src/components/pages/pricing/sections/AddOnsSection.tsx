import { useTranslation } from 'react-i18next';

interface AddOn {
    name: string;
    description: string;
    price: string;
    available: boolean;
    phase?: string;
}

export default function AddOnsSection() {
    const { t } = useTranslation();

    const addons: AddOn[] = [
        {
            name: t('pricing.addons.conversations.name', 'Thêm Conversations'),
            description: t('pricing.addons.conversations.desc', 'Khi vượt quá quota tháng.'),
            price: '$10/1000 chats',
            available: true,
        },
        {
            name: t('pricing.addons.retention.name', 'Thêm Retention'),
            description: t('pricing.addons.retention.desc', 'Mở rộng lưu trữ lịch sử.'),
            price: '$5/tháng',
            available: true,
        },
        {
            name: t('pricing.addons.automation.name', 'Automation Workflows'),
            description: t('pricing.addons.automation.desc', 'Tự động hóa nâng cao.'),
            price: 'Coming Soon',
            available: false,
            phase: 'Phase 3',
        },
        {
            name: t('pricing.addons.omnichannel.name', 'Omnichannel Plus'),
            description: t('pricing.addons.omnichannel.desc', 'Tích hợp WhatsApp, IG.'),
            price: 'Coming Soon',
            available: false,
            phase: 'Phase 3',
        },
    ];

    return (
        <section className="py-12 px-6 bg-gray-50">
            <div className="max-w-[1200px] mx-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-electric-blue">extension</span>
                    {t('pricing.addons.title', 'Gói mở rộng (Add-ons)')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {addons.map((addon) => (
                        <div
                            key={addon.name}
                            className={`bg-white p-5 rounded-xl border border-gray-200 transition-all ${addon.available ? 'hover:border-electric-blue hover:shadow-lg' : 'opacity-70'
                                }`}
                        >
                            <div className="flex justify-between">
                                <div className="text-sm font-bold text-gray-900 mb-1">{addon.name}</div>
                                {addon.phase && (
                                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                        {addon.phase}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mb-3">{addon.description}</p>
                            <div
                                className={`text-lg font-bold mb-3 ${addon.available ? 'text-electric-blue' : 'text-gray-400'
                                    }`}
                            >
                                {addon.available ? (
                                    <>
                                        {addon.price.split('/')[0]}
                                        <span className="text-sm font-normal text-gray-500">
                                            /{addon.price.split('/')[1]}
                                        </span>
                                    </>
                                ) : (
                                    addon.price
                                )}
                            </div>
                            {addon.available && (
                                <button className="w-full py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 border border-gray-200 transition-colors font-medium">
                                    {t('pricing.addons.buy', 'Mua thêm')}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
