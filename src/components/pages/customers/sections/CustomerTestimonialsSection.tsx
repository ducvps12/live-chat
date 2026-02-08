export default function CustomerTestimonialsSection() {
    const testimonials = [
        {
            id: 1,
            quote:
                'Trước đây chúng tôi mất trung bình 30 phút để phản hồi khách. Với Nemark Inbox, con số này giảm xuống dưới 2 phút. Doanh số tăng rõ rệt.',
            name: 'Hoàng Minh',
            role: 'Sales Manager, TechFlow',
            avatarGradient: 'from-electric-blue to-electric-purple',
        },
        {
            id: 2,
            quote:
                'Tính năng phân công chat tự động là cứu cánh cho team 20 người của tôi. Không còn ai phải hỏi "khách này của ai?" nữa.',
            name: 'Thảo Trang',
            role: 'Head of CS, BeautyBox',
            avatarGradient: 'from-electric-teal to-electric-blue',
        },
        {
            id: 3,
            quote:
                'Setup cực kỳ đơn giản. Chỉ mất 5 phút gắn code là website đã có live chat xịn xò. Giao diện quản lý rất clean và dễ dùng.',
            name: 'Tuấn Anh',
            role: 'Founder, Startup Gear',
            avatarGradient: 'from-electric-purple to-electric-teal',
        },
    ];

    return (
        <section className="py-20 px-6 bg-gradient-to-br from-electric-blue/5 via-electric-purple/5 to-electric-teal/5 relative z-10 border-y border-gray-200">
            <div className="max-w-[1280px] mx-auto">
                <h2 className="text-3xl font-bold text-center mb-16 text-gray-900">
                    Khách hàng nói gì về <span className="text-electric-blue">Nemark Inbox</span>?
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial) => (
                        <div key={testimonial.id} className="glass-panel p-8 rounded-2xl relative transition-all duration-300 bg-white hover:-translate-y-1">
                            {/* Quote icon */}
                            <span className="material-symbols-outlined text-4xl text-electric-blue/20 absolute top-6 left-6">
                                format_quote
                            </span>

                            {/* Quote text */}
                            <p className="text-gray-700 italic mb-8 pt-6 relative z-10">{testimonial.quote}</p>

                            {/* Author */}
                            <div className="flex items-center gap-4">
                                <div className={`size-12 rounded-full bg-gradient-to-br ${testimonial.avatarGradient}`}></div>
                                <div>
                                    <div className="font-bold text-gray-900 text-sm">{testimonial.name}</div>
                                    <div className="text-xs text-gray-500">{testimonial.role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
