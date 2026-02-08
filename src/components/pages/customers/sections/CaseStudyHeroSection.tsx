import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export default function CaseStudyHeroSection() {
    const { t } = useTranslation();

    return (
        <section className="relative z-10 pt-32 pb-16 lg:pt-48 lg:pb-24 px-6">
            <div className="max-w-[1000px] mx-auto text-center flex flex-col gap-6 mb-16">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-electric-blue/30 bg-electric-blue/5 text-electric-blue w-fit mx-auto">
                    <span className="text-xs font-bold uppercase tracking-wider">Kết quả thực tế</span>
                </div>

                {/* Headline */}
                <h1 className="text-4xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-gray-900">
                    Các đội Sales & CSKH dùng Nemark Inbox để{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue via-electric-purple to-electric-teal">phản hồi nhanh</span> và{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-teal via-electric-purple to-electric-blue">chốt nhiều hơn.</span>
                </h1>

                {/* Description */}
                <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
                    Khám phá cách hơn 2,000 doanh nghiệp đang sử dụng hội thoại làm vũ khí cạnh tranh chính để tăng trưởng doanh thu bền vững.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/auth/register">
                        <button className="h-12 px-8 bg-electric-blue hover:shadow-[0_0_30px_rgba(13,166,242,0.4)] text-white text-base font-bold rounded-full transition-all active:scale-95 flex items-center justify-center gap-2">
                            Dùng thử miễn phí
                        </button>
                    </Link>
                    <Link href="/demo/request">
                        <button className="h-12 px-8 bg-transparent border border-white/20 hover:bg-white/5 text-white text-base font-bold rounded-full flex items-center justify-center gap-2">
                            Yêu cầu demo
                        </button>
                    </Link>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-2">
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-electric-teal">verified_user</span>
                        14 ngày dùng thử miễn phí
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                    <span>Không cần thẻ tín dụng</span>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="max-w-[1100px] mx-auto relative z-20">
                <div className="glass-panel rounded-3xl p-6 border border-gray-200 shadow-lg bg-white">
                    {/* Search & Toggle */}
                    <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between mb-6">
                        <div className="relative w-full lg:w-96 group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
                                search
                            </span>
                            <input
                                className="w-full h-12 bg-white border border-gray-300 rounded-xl pl-12 pr-4 text-gray-900 placeholder-gray-400 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue focus:outline-none transition-all"
                                placeholder="Tìm theo ngành, quy mô, use case..."
                                type="text"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input className="sr-only peer" type="checkbox" defaultChecked />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-electric-blue"></div>
                                <span className="ms-3 text-sm font-medium text-gray-700">Hiển thị case nổi bật trước</span>
                            </label>
                        </div>
                    </div>

                    {/* Filter Chips */}
                    <div className="space-y-4">
                        {/* Industry */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase w-16">Ngành:</span>
                            <div className="flex flex-wrap gap-2">
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors hover:border-electric-blue hover:text-electric-blue">
                                    Thương mại điện tử
                                </button>
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    SaaS / Công nghệ
                                </button>
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    Giáo dục
                                </button>
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    Bất động sản
                                </button>
                            </div>
                        </div>

                        {/* Role */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase w-16">Vai trò:</span>
                            <div className="flex flex-wrap gap-2">
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    Sales Leader
                                </button>
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    CSKH Manager
                                </button>
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    Founder
                                </button>
                            </div>
                        </div>

                        {/* Goal */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase w-16">Mục tiêu:</span>
                            <div className="flex flex-wrap gap-2">
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    Thu lead tự nhiên
                                </button>
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    Tăng tốc độ phản hồi
                                </button>
                                <button className="px-4 py-1.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors focus:border-primary focus:text-primary focus:bg-primary/10">
                                    Tự động hóa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
