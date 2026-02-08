import Link from 'next/link';

export default function DemoCTASection() {
    const workflow = ['Copy snippet', 'Nhận chat', 'Lưu contact', 'Đo SLA'];

    return (
        <section className="py-32 px-6 relative z-10 overflow-hidden text-center bg-gradient-to-br from-electric-blue/10 via-electric-purple/5 to-electric-teal/10">
            {/* Decorative blobs */}
            <div className="absolute top-20 right-20 w-72 h-72 bg-electric-blue/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-72 h-72 bg-electric-purple/10 rounded-full blur-3xl"></div>

            <div className="max-w-4xl mx-auto relative z-10">
                <h2 className="text-3xl lg:text-5xl font-bold mb-6 tracking-tight text-gray-900">
                    Sẵn sàng thử trên website của bạn?
                </h2>

                {/* Workflow Steps */}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600 font-mono mb-10 bg-white/80 px-4 py-2 rounded-full w-fit mx-auto border border-gray-200 shadow-sm">
                    {workflow.map((step, index) => (
                        <span key={index} className="flex items-center gap-2">
                            <span>{step}</span>
                            {index < workflow.length - 1 && <span className="text-gray-400">→</span>}
                        </span>
                    ))}
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/auth/register">
                        <button className="h-14 px-10 bg-electric-blue hover:shadow-[0_0_40px_rgba(13,166,242,0.4)] text-white text-lg font-bold rounded-full shadow-lg transition-all active:scale-95">
                            Dùng thử miễn phí
                        </button>
                    </Link>
                    <Link href="/auth/register">
                        <button className="h-14 px-10 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-lg font-bold rounded-full transition-all shadow-sm">
                            Dùng thử miễn phí
                        </button>
                    </Link>
                </div>

                <p className="mt-6 text-sm text-gray-500">Cài đặt trong 2 phút. Không cần thẻ tín dụng. Hỗ trợ trọn đời.</p>
            </div>
        </section>
    );
}
