import Link from 'next/link';

export default function CustomerCTASection() {
    return (
        <section className="py-32 px-6 relative z-10 overflow-hidden bg-gradient-to-br from-electric-blue/10 via-electric-purple/5 to-electric-teal/10">
            {/* Optional decorative elements */}
            <div className="absolute top-20 right-20 w-72 h-72 bg-electric-blue/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-72 h-72 bg-electric-purple/10 rounded-full blur-3xl"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
                {/* Headline */}
                <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight text-gray-900">
                    Muốn tạo kết quả tương tự <br />
                    trên website của bạn?
                </h2>

                {/* Features */}
                <p className="text-xl text-gray-600 mb-8 flex flex-wrap justify-center gap-4 lg:gap-8 font-medium">
                    <span>Setup 5 phút</span>
                    <span className="text-gray-400">•</span>
                    <span>Inbox rõ</span>
                    <span className="text-gray-400">•</span>
                    <span>CRM-lite</span>
                    <span className="text-gray-400">•</span>
                    <span>SLA report</span>
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                    <Link href="/auth/register">
                        <button className="h-14 px-10 bg-electric-blue hover:shadow-[0_0_30px_rgba(13,166,242,0.4)] text-white text-lg font-bold rounded-full shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                            Dùng thử miễn phí
                        </button>
                    </Link>
                    <Link href="/demo/request">
                        <button className="h-14 px-10 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-lg font-bold rounded-full flex items-center justify-center gap-2 transition-all shadow-sm">
                            Yêu cầu demo
                        </button>
                    </Link>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-gray-500">Không cần thẻ tín dụng • Hủy bất kỳ lúc nào</p>
            </div>
        </section>
    );
}
