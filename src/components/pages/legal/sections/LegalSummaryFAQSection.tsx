import Link from 'next/link';

export default function LegalSummaryFAQSection() {
    const faqs = [
        {
            question: 'Dữ liệu của tôi được lưu trữ ở đâu?',
            answer:
                'Máy chủ chính của Nemark Inbox được đặt tại các trung tâm dữ liệu của AWS (Amazon Web Services) tại Singapore và Tokyo, đảm bảo tốc độ cao và tuân thủ các tiêu chuẩn bảo mật quốc tế ISO 27001.',
        },
        {
            question: 'Nemark có tuân thủ GDPR không?',
            answer:
                'Có. Chúng tôi tuân thủ đầy đủ Quy định bảo vệ dữ liệu chung (GDPR) của EU. Chúng tôi cung cấp các công cụ để bạn (Controller) thực hiện quyền của chủ thể dữ liệu (như quyền truy cập, chỉnh sửa, xóa bỏ).',
        },
        {
            question: 'Làm sao để tôi ký DPA với Nemark?',
            answer:
                'DPA (Thỏa thuận xử lý dữ liệu) được tích hợp sẵn trong Điều khoản sử dụng của chúng tôi. Nếu doanh nghiệp của bạn cần bản ký riêng, vui lòng liên hệ đội ngũ pháp lý hoặc yêu cầu qua Dashboard quản trị.',
        },
        {
            question: 'Quy trình xóa dữ liệu khi tôi hủy dịch vụ là gì?',
            answer:
                'Khi bạn hủy tài khoản, dữ liệu sẽ được đưa vào trạng thái "pending deletion" trong 30 ngày (để phòng trường hợp bạn đổi ý). Sau 30 ngày, toàn bộ dữ liệu sẽ được xóa vĩnh viễn khỏi hệ thống active và xóa khỏi bản backup sau tối đa 90 ngày.',
        },
        {
            question: 'Nemark có bán dữ liệu của tôi cho bên thứ 3 không?',
            answer:
                'Tuyệt đối không. Mô hình kinh doanh của chúng tôi là Subscription (thu phí phần mềm). Dữ liệu của bạn là tài sản của bạn, chúng tôi không bao giờ bán, cho thuê hoặc chia sẻ dữ liệu đó cho mục đích quảng cáo.',
        },
    ];

    return (
        <>
            {/* Summary Section */}
            <section className="py-16 px-6 relative z-10">
                <div className="max-w-[1280px] mx-auto">
                    <h2 className="text-3xl lg:text-4xl font-bold mb-12 text-center text-gray-900">Tóm tắt nhanh</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Business Summary */}
                        <div className="glass-panel p-8 rounded-3xl border border-gray-200 bg-gradient-to-br from-electric-blue/5 to-transparent relative overflow-hidden bg-white shadow-lg">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-300 text-gray-700">
                                    <span className="material-symbols-outlined">domain</span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Nếu bạn là Khách hàng Doanh nghiệp</h3>
                            </div>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-electric-teal mt-0.5">lock</span>
                                    <div>
                                        <strong className="text-gray-900 block text-sm">Mã hóa & Cách ly dữ liệu</strong>
                                        <span className="text-sm text-gray-600">
                                            Dữ liệu được mã hóa AES-256 và lưu trữ tách biệt (Logical Separation).
                                        </span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-electric-teal mt-0.5">admin_panel_settings</span>
                                    <div>
                                        <strong className="text-gray-900 block text-sm">Kiểm soát quyền (RBAC)</strong>
                                        <span className="text-sm text-gray-600">
                                            Bạn có toàn quyền cấp/thu hồi quyền truy cập dữ liệu của nhân viên.
                                        </span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-electric-teal mt-0.5">delete_forever</span>
                                    <div>
                                        <strong className="text-gray-900 block text-sm">Retention linh hoạt</strong>
                                        <span className="text-sm text-gray-600">
                                            Tự cấu hình thời gian xóa dữ liệu tự động theo gói Subscription.
                                        </span>
                                    </div>
                                </li>
                            </ul>
                            <div className="flex gap-4 flex-wrap">
                                <Link href="/security" className="text-sm font-bold text-gray-900 hover:text-electric-blue transition-colors flex items-center gap-1">
                                    Xem Bảo mật <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </Link>
                                <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-bold text-gray-700 transition-all">
                                    Yêu cầu demo (Compliance)
                                </button>
                            </div>
                        </div>

                        {/* Visitor Summary */}
                        <div className="glass-panel p-8 rounded-3xl border border-gray-200 bg-gradient-to-br from-electric-purple/5 to-transparent relative overflow-hidden bg-white shadow-lg">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-300 text-gray-700">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Nếu bạn là Visitor của website dùng Nemark</h3>
                            </div>
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-electric-purple mt-0.5">fingerprint</span>
                                    <div>
                                        <strong className="text-gray-900 block text-sm">Nhận diện ẩn danh</strong>
                                        <span className="text-sm text-gray-600">
                                            Chúng tôi dùng Cookie để duy trì hội thoại, không theo dõi chéo site khác.
                                        </span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-electric-purple mt-0.5">contact_mail</span>
                                    <div>
                                        <strong className="text-gray-900 block text-sm">Thu thập thông tin</strong>
                                        <span className="text-sm text-gray-600">
                                            Chỉ lưu Email/SĐT khi bạn chủ động cung cấp qua khung chat.
                                        </span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-electric-purple mt-0.5">block</span>
                                    <div>
                                        <strong className="text-gray-900 block text-sm">Quyền yêu cầu xóa (Opt-out)</strong>
                                        <span className="text-sm text-gray-600">
                                            Bạn có thể yêu cầu chủ website xóa toàn bộ lịch sử chat của bạn.
                                        </span>
                                    </div>
                                </li>
                            </ul>
                            <div className="flex gap-4">
                                <Link href="#" className="text-sm font-bold text-gray-900 hover:text-electric-blue transition-colors flex items-center gap-1">
                                    Đọc Privacy Policy <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 px-6 relative z-10">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Câu hỏi thường gặp về Pháp lý</h2>
                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <div key={index} className="glass-panel rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm">
                                <details className="group p-6 cursor-pointer">
                                    <summary className="flex justify-between items-center font-bold text-lg list-none text-gray-900 group-hover:text-electric-blue transition-colors">
                                        {faq.question}
                                        <span className="transition group-open:rotate-180 material-symbols-outlined text-gray-400">
                                            expand_more
                                        </span>
                                    </summary>
                                    <p className="text-gray-600 mt-4 leading-relaxed">{faq.answer}</p>
                                </details>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="py-10 px-6 relative z-10" id="contact-legal">
                <div className="max-w-[1280px] mx-auto">
                    <div className="glass-panel p-8 rounded-3xl border border-electric-blue/30 bg-gradient-to-r from-electric-blue/10 to-electric-purple/10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                        <div className="relative z-10 md:w-1/2">
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">Cần tài liệu cho compliance / pháp lý?</h3>
                            <div className="space-y-2 text-gray-600 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-electric-blue text-base">email</span>
                                    <span>
                                        Pháp lý: <span className="text-gray-900 font-mono font-bold">legal@nemark.com</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-electric-blue text-base">security</span>
                                    <span>
                                        Bảo mật: <span className="text-gray-900 font-mono font-bold">security@nemark.com</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
                            <button className="h-12 px-6 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-bold rounded-full transition-all flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-500">wifi</span> Xem Status hệ thống
                            </button>
                            <button className="h-12 px-6 bg-electric-blue hover:shadow-[0_0_20px_rgba(13,166,242,0.3)] text-white text-sm font-bold rounded-full transition-all">
                                Yêu cầu demo (compliance Q&A)
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-xs text-gray-500 mt-4 max-w-2xl mx-auto">
                        *Các yêu cầu pháp lý sẽ được phản hồi trong vòng 24-48 giờ làm việc. Đối với yêu cầu khẩn cấp về bảo mật,
                        vui lòng sử dụng kênh hotline dành cho khách hàng Enterprise.
                    </p>
                </div>
            </section>
        </>
    );
}
