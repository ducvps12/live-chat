export default function DemoFAQSection() {
    const faqs = [
        {
            question: 'Buổi demo kéo dài bao lâu?',
            answer:
                'Thông thường khoảng 20-30 phút. Chúng tôi sẽ dành 5 phút đầu để hiểu nhu cầu, 15 phút demo giải pháp và thời gian còn lại cho Q&A.',
        },
        {
            question: 'Tôi có thể mời team tham gia không?',
            answer:
                'Chắc chắn rồi! Chúng tôi khuyến khích bạn mời các trưởng bộ phận Sales, CSKH hoặc Technical để có cái nhìn toàn diện nhất.',
        },
        {
            question: 'Nemark Inbox có tích hợp với CRM của tôi không?',
            answer:
                'Chúng tôi có sẵn integration với Salesforce, HubSpot, Pipedrive và Zoho. Ngoài ra bạn có thể dùng Webhook/API để kết nối với hệ thống nội bộ.',
        },
        {
            question: 'Sau demo tôi có được dùng thử không?',
            answer:
                'Có, chúng tôi sẽ kích hoạt gói Enterprise Trial 14 ngày cho workspace của bạn ngay sau buổi demo để bạn trải nghiệm đầy đủ tính năng.',
        },
    ];

    return (
        <section className="py-20 px-6 bg-white">
            <div className="max-w-[800px] mx-auto">
                <h2 className="text-2xl font-bold text-center mb-10 text-gray-900">Câu hỏi thường gặp</h2>
                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <details key={index} className="group glass-panel rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm">
                            <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                                <span className="text-sm font-bold text-gray-800">{faq.question}</span>
                                <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
                                    expand_more
                                </span>
                            </summary>
                            <div className="px-4 pb-4 pt-0 text-sm text-gray-600 leading-relaxed">{faq.answer}</div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
