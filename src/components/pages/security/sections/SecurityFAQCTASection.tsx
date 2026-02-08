export default function SecurityFAQCTASection() {
    const faqs = [
        {
            question: 'Dữ liệu của tôi được lưu trữ ở đâu?',
            answer: 'Máy chủ chính của chúng tôi đặt tại Singapore (AWS/GCP) để tối ưu tốc độ cho khu vực APAC.',
        },
        {
            question: 'Nemark có truy cập dữ liệu chat của tôi không?',
            answer:
                'Về mặt kỹ thuật, một số kỹ sư nòng cốt có quyền truy cập để bảo trì (với audit log nghiêm ngặt). Về mặt chính sách, chúng tôi không bao giờ đọc nội dung chat trừ khi được bạn yêu cầu hỗ trợ cụ thể.',
        },
        {
            question: 'Làm sao để báo cáo lỗ hổng bảo mật?',
            answer:
                'Vui lòng xem phần "Liên hệ bảo mật" bên dưới để biết chi tiết về chương trình Responsible Disclosure của chúng tôi.',
        },
    ];

    return (
        <>
            {/* FAQ Section */}
            <section className="max-w-3xl mx-auto px-6 mb-32">
                <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Câu hỏi thường gặp</h2>
                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <details key={index} className="glass-panel rounded-xl group bg-white shadow-sm">
                            <summary className="flex items-center justify-between p-6 cursor-pointer list-none text-gray-900 font-medium">
                                {faq.question}
                                <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
                                    expand_more
                                </span>
                            </summary>
                            <div className="px-6 pb-6 text-gray-600 text-sm">{faq.answer}</div>
                        </details>
                    ))}
                </div>
            </section>

            {/* Contact Section */}
            <section className="max-w-5xl mx-auto px-6 mb-32">
                <div className="glass-panel p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-8 border-l-4 border-l-electric-blue bg-white shadow-lg">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Liên hệ bảo mật & Responsible Disclosure</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Nếu bạn phát hiện vấn đề bảo mật, vui lòng báo cáo cho chúng tôi. Chúng tôi cam kết điều tra và khắc phục
                            kịp thời.
                        </p>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded border border-gray-300 text-sm font-mono text-electric-blue">
                            security@nemark.com
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button className="px-6 py-3 rounded-full bg-gray-900 text-white font-bold text-sm hover:bg-gray-700 transition-colors">
                            Báo cáo vấn đề
                        </button>
                        <button className="px-6 py-3 rounded-full border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors">
                            Xem PGP Key
                        </button>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="max-w-4xl mx-auto px-6 text-center mb-24">
                <h2 className="text-4xl font-bold text-gray-900 mb-6">Muốn demo tập trung vào bảo mật và phân quyền?</h2>
                <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-600 mb-10">
                    <span>RBAC theo scope</span> •<span>Audit log</span> •<span>Retention theo gói</span> •
                    <span>Export có kiểm soát</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button className="h-14 px-10 rounded-full bg-electric-blue hover:shadow-[0_0_40px_rgba(13,166,242,0.4)] text-white font-bold text-lg transition-all active:scale-95">
                        Yêu cầu demo
                    </button>
                    <button className="h-14 px-10 rounded-full bg-transparent text-gray-700 hover:text-gray-900 font-bold transition-colors">
                        Xem Tài liệu kỹ thuật
                    </button>
                </div>
            </section>
        </>
    );
}
