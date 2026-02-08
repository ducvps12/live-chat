import { useState } from 'react';
import Link from 'next/link';

export default function DemoHeroSection() {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        timezone: 'Vietnam (GMT+7)',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleContinue = () => {
        // For now, just show alert. Can expand to step 2, 3 later
        alert('Form submitted! (Step 2 & 3 can be implemented next)');
    };

    return (
        <section className="relative z-10 pt-32 pb-20 lg:pt-40 lg:pb-24 px-6 min-h-screen flex flex-col justify-center">
            <div className="max-w-[1280px] mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* Left Column - Content */}
                <div className="lg:col-span-6 pt-4 flex flex-col gap-8 relative">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-electric-blue/30 bg-electric-blue/5 text-electric-blue w-fit backdrop-blur-md">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-electric-blue opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-electric-blue"></span>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider">Yêu cầu demo cho team</span>
                    </div>

                    {/* Headline */}
                    <div>
                        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.15] tracking-tight mb-6 text-gray-900">
                            Nhận buổi demo <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-blue to-electric-teal">
                                cá nhân hóa
                            </span>{' '}
                            theo ngành & quy mô của bạn.
                        </h1>
                        <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
                            Khám phá cách Nemark Inbox giúp doanh nghiệp của bạn tăng 35% tỷ lệ chuyển đổi và tự động hóa 60% hội
                            thoại.
                        </p>
                    </div>

                    {/* Benefits Box */}
                    <div className="glass-panel p-6 rounded-2xl bg-white border-l-4 border-l-electric-blue">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Bạn sẽ nhận được gì?</h3>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <div className="mt-1 size-5 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue flex-shrink-0">
                                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                                </div>
                                <span className="text-gray-700 text-sm">Kịch bản Live Chat & Automation đúng ngành của bạn</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 size-5 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue flex-shrink-0">
                                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                                </div>
                                <span className="text-gray-700 text-sm">Gợi ý cấu hình đội Sales/CSKH tối ưu (Routing, SLA)</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 size-5 rounded-full bg-electric-blue/20 flex items-center justify-center text-electric-blue flex-shrink-0">
                                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                                </div>
                                <span className="text-gray-700 text-sm">Kế hoạch triển khai & Go-live trong 5–7 ngày</span>
                            </li>
                        </ul>
                    </div>

                    {/* Quick Link */}
                    <div>
                        <Link
                            href="#"
                            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-electric-blue transition-colors border-b border-transparent hover:border-electric-blue pb-0.5"
                        >
                            <span className="material-symbols-outlined text-lg">play_circle</span>
                            Chưa muốn nói chuyện? Xem demo tự động 60 giây
                        </Link>
                    </div>

                    {/* Enterprise Features */}
                    <div className="pt-6 border-t border-gray-200 flex flex-wrap gap-x-6 gap-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                            <span className="material-symbols-outlined text-sm">security</span> RBAC theo scope
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                            <span className="material-symbols-outlined text-sm">history</span> Audit log
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                            <span className="material-symbols-outlined text-sm">api</span> API/Webhooks
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono">
                            <span className="material-symbols-outlined text-sm">support_agent</span> Hỗ trợ triển khai
                        </div>
                    </div>
                </div>

                {/* Right Column - Form */}
                <div className="lg:col-span-6 relative">
                    {/* Glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-b from-electric-blue/20 to-electric-purple/10 rounded-3xl blur-lg opacity-50"></div>

                    <div className="glass-panel relative rounded-2xl p-8 lg:p-10 bg-white shadow-2xl border border-gray-200">
                        {/* Step Indicator */}
                        <div className="flex items-center justify-between mb-8 text-xs font-bold uppercase tracking-wider">
                            <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-electric-blue' : 'text-gray-400'}`}>
                                <span
                                    className={`flex items-center justify-center size-6 rounded-full border ${currentStep === 1 ? 'bg-electric-blue/20 border-electric-blue text-electric-blue' : 'border-gray-300 bg-gray-100 text-gray-400'
                                        }`}
                                >
                                    1
                                </span>
                                <span>Liên hệ</span>
                            </div>
                            <div className="flex-1 h-0.5 bg-gray-200 mx-3"></div>
                            <div className="flex items-center gap-2 text-gray-400">
                                <span className="flex items-center justify-center size-6 rounded-full border border-gray-300 bg-gray-100">2</span>
                                <span className="hidden sm:inline">Doanh nghiệp</span>
                            </div>
                            <div className="flex-1 h-0.5 bg-gray-200 mx-3"></div>
                            <div className="flex items-center gap-2 text-gray-400">
                                <span className="flex items-center justify-center size-6 rounded-full border border-gray-300 bg-gray-100">3</span>
                                <span className="hidden sm:inline">Nhu cầu</span>
                            </div>
                        </div>

                        {/* Form */}
                        <form className="space-y-5 relative" onSubmit={(e) => e.preventDefault()}>
                            {/* Full Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Họ và tên <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleInputChange}
                                        className="w-full bg-white border border-gray-300 rounded-lg pl-4 pr-10 py-3 text-sm text-gray-900 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue focus:outline-none transition-all"
                                        placeholder="Nguyễn Văn A"
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-gray-400 text-lg">person</span>
                                    </div>
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <div className="flex justify-between">
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Email công ty <span className="text-red-500">*</span>
                                    </label>
                                    <span className="text-xs text-gray-400 mt-0.5 italic">Chúng tôi không chấp nhận @gmail.com</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="w-full bg-white border border-gray-300 rounded-lg pl-4 pr-10 py-3 text-sm text-gray-900 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue focus:outline-none transition-all"
                                        placeholder="name@company.com"
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="material-symbols-outlined text-gray-400 text-lg">business_center</span>
                                    </div>
                                </div>
                            </div>

                            {/* Phone & Timezone */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue focus:outline-none transition-all"
                                        placeholder="+84 90 123 4567"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Quốc gia / Múi giờ</label>
                                    <div className="relative">
                                        <select
                                            name="timezone"
                                            value={formData.timezone}
                                            onChange={handleInputChange}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue focus:outline-none transition-all appearance-none"
                                        >
                                            <option>Vietnam (GMT+7)</option>
                                            <option>Singapore (GMT+8)</option>
                                            <option>United States (GMT-5)</option>
                                            <option>Australia (GMT+11)</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="material-symbols-outlined text-gray-400 text-sm">expand_more</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button
                                    type="button"
                                    onClick={handleContinue}
                                    className="w-full h-12 bg-electric-blue hover:shadow-[0_0_30px_rgba(13,166,242,0.4)] text-white text-base font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                                >
                                    Tiếp tục
                                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                </button>
                            </div>

                            <p className="text-center text-xs text-gray-500 mt-4">
                                <span className="material-symbols-outlined text-[10px] align-middle mr-1">save</span>
                                Tự động lưu. Bạn có thể quay lại bất cứ lúc nào.
                            </p>
                        </form>

                        {/* Corner decorations */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-gray-300 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-gray-300 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-gray-300 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-gray-300 rounded-br-lg"></div>
                    </div>
                </div>
            </div>
        </section>
    );
}
