import { useTranslation } from 'react-i18next';
import { useState } from 'react';

interface FAQItem {
    question: string;
    answer: string;
}

export default function FAQSection() {
    const { t } = useTranslation();
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const faqs: FAQItem[] = [
        {
            question: t('pricing.faq.upgrade.q', 'Tôi có thể nâng cấp/hạ cấp gói bất cứ lúc nào không?'),
            answer: t(
                'pricing.faq.upgrade.a',
                'Có. Việc thay đổi gói sẽ có hiệu lực ngay lập tức. Hệ thống sẽ tự động tính toán chênh lệch (proration) và cộng vào credits hoặc trừ vào hóa đơn tiếp theo của bạn.'
            ),
        },
        {
            question: t('pricing.faq.agent.q', '"Agent" được tính như thế nào?'),
            answer: t(
                'pricing.faq.agent.a',
                'Chúng tôi tính tiền dựa trên số lượng "ghế" (seats) mà bạn mua. Bạn có thể thêm/xóa người dùng vào các ghế này. Ví dụ gói Growth bao gồm 5 agents, bạn có thể mời tối đa 5 người vào team.'
            ),
        },
        {
            question: t('pricing.faq.refund.q', 'Chính sách hoàn tiền (Refund) ra sao?'),
            answer: t(
                'pricing.faq.refund.a',
                'Chúng tôi có chính sách hoàn tiền trong 7 ngày đầu tiên nếu bạn không hài lòng với dịch vụ mà không cần lý do.'
            ),
        },
        {
            question: t('pricing.faq.card.q', 'Tôi có cần thẻ tín dụng để dùng thử không?'),
            answer: t(
                'pricing.faq.card.a',
                'Không. Bạn chỉ cần email để bắt đầu dùng thử 14 ngày gói Growth. Chúng tôi chỉ yêu cầu thông tin thanh toán khi bạn quyết định mua chính thức.'
            ),
        },
    ];

    return (
        <section className="py-20 px-6 relative z-10">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">
                    {t('pricing.faq.title', 'Câu hỏi về Billing')}
                </h2>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div key={index} className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full p-6 flex justify-between items-center font-bold text-lg text-left text-gray-900 hover:text-electric-blue transition-colors"
                            >
                                <span>{faq.question}</span>
                                <span
                                    className={`material-symbols-outlined transition-transform text-gray-400 ${openIndex === index ? 'rotate-180' : ''
                                        }`}
                                >
                                    expand_more
                                </span>
                            </button>
                            {openIndex === index && (
                                <div className="px-6 pb-6">
                                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
