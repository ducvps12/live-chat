export default function LegalHeroSection() {
    return (
        <>
            {/* Hero */}
            <section className="relative z-10 pt-32 pb-16 lg:pt-48 lg:pb-12 px-6 text-center">
                <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 relative">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-electric-blue/30 bg-electric-blue/5 text-electric-blue">
                        <span className="text-xs font-bold uppercase tracking-wider">Legal & Policies</span>
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-gray-900">
                        Chính sách & Điều khoản của{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-electric-teal to-electric-blue">
                            Nemark Inbox.
                        </span>
                    </h1>
                    <p className="text-lg lg:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
                        Trung tâm tài liệu pháp lý minh bạch, giúp bạn hiểu rõ quyền lợi, trách nhiệm và cách chúng tôi cam kết bảo
                        vệ dữ liệu của bạn.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 mt-4">
                        <a
                            href="#privacy"
                            className="h-12 px-8 bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 text-base font-bold rounded-full flex items-center justify-center gap-2 group transition-all"
                        >
                            Xem Bảo mật
                        </a>
                        <a
                            href="#contact-legal"
                            className="h-12 px-8 text-gray-600 hover:text-gray-900 text-base font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            Liên hệ pháp lý <span className="material-symbols-outlined text-sm">arrow_downward</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* Search/Filter Panel */}
            <section className="relative z-20 px-4 lg:px-6 mb-24 -mt-8">
                <div className="max-w-[1000px] mx-auto glass-panel rounded-2xl p-6 lg:p-8 bg-white shadow-xl border border-gray-200">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 text-gray-900 font-bold text-lg w-full md:w-auto">
                                <span className="material-symbols-outlined text-electric-blue">manage_search</span> Legal Finder
                            </div>
                            <div className="relative w-full md:w-[60%] group">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-electric-blue transition-colors">
                                    search
                                </span>
                                <input
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-electric-blue focus:border-electric-blue transition-all outline-none"
                                    placeholder="Tìm: retention, export, cookie, delete, DPA…"
                                    type="text"
                                />
                            </div>
                        </div>
                        <div className="h-px bg-gray-200 w-full"></div>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-gray-500 uppercase mr-2">Lọc nhanh:</span>
                            <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 hover:text-electric-blue hover:border-electric-blue transition-all">
                                Người dùng
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 hover:text-electric-blue hover:border-electric-blue transition-all">
                                Doanh nghiệp
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 hover:text-electric-blue hover:border-electric-blue transition-all">
                                Developer
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 hover:text-electric-blue hover:border-electric-blue transition-all">
                                Compliance
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
