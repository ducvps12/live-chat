import React, { useState } from 'react';
import { toast } from 'sonner';
import { WidgetService } from '@/services/widget.service';
import { isValidDomain, isValidHexColor, copyToClipboard } from '@/utils/onboarding';
import { UseOnboardingReturn } from '@/hooks/useOnboarding';

interface Step3Props {
    onboarding: UseOnboardingReturn;
}

export const Step3WidgetSetup: React.FC<Step3Props> = ({ onboarding }) => {
    const workspaceId = onboarding.workspace?.workspaceId;

    // Form state
    const [domainInput, setDomainInput] = useState('');
    const [domains, setDomains] = useState<string[]>(['localhost:3000']);
    const [widgetName, setWidgetName] = useState('Nemark Support');
    const [position, setPosition] = useState<'br' | 'bl'>('br');
    const [mainColor, setMainColor] = useState('#2563eb');
    const [welcomeMsg, setWelcomeMsg] = useState('');
    const [testUrl, setTestUrl] = useState('');

    // Widget result
    const [embedCode, setEmbedCode] = useState('');
    const [widgetCreated, setWidgetCreated] = useState(false);

    // Loading state
    const [isLoading, setIsLoading] = useState(false);

    const addDomain = () => {
        const trimmed = domainInput.trim().toLowerCase();
        if (!trimmed) return;

        if (!isValidDomain(trimmed)) {
            toast.error('Domain không hợp lệ');
            return;
        }

        if (domains.includes(trimmed)) {
            toast.error('Domain đã tồn tại');
            return;
        }

        setDomains([...domains, trimmed]);
        setDomainInput('');
    };

    const removeDomain = (domain: string) => {
        setDomains(domains.filter((d) => d !== domain));
    };

    const handleColorChange = (value: string) => {
        if (value.startsWith('#') && value.length <= 7) {
            setMainColor(value.toUpperCase());
        }
    };

    const handleCreateWidget = async () => {
        if (!workspaceId) {
            toast.error('Workspace không tồn tại');
            return;
        }

        if (!widgetName.trim()) {
            toast.error('Vui lòng nhập tên widget');
            return;
        }

        if (!isValidHexColor(mainColor)) {
            toast.error('Màu không hợp lệ');
            return;
        }

        setIsLoading(true);

        try {
            // Create widget
            const result = await WidgetService.create(workspaceId, {
                name: widgetName.trim(),
                allowedDomains: domains,
                theme: {
                    color: mainColor,
                    position,
                    title: welcomeMsg || 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
                },
            });

            const widgetId = result.widget.widgetId;
            const siteKey = result.widget.siteKey;

            // Get embed code from create response or fetch separately
            let code = result.embedCode || '';
            if (!code) {
                try {
                    const embedResult = await WidgetService.getEmbedCode(workspaceId, widgetId);
                    code = embedResult.embedCode;
                } catch {
                    // Fallback embed code if API doesn't have this endpoint
                    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.nemark.vn';
                    code = `<script async src="${apiBase}/widget.js" data-widget-id="${widgetId}" data-api-base="${apiBase}"></script>`;
                }
            }

            setEmbedCode(code);
            setWidgetCreated(true);

            // Save to onboarding state
            onboarding.setWidget({
                widgetId,
                siteKey,
                name: widgetName,
                domains,
                mainColor,
                position,
                welcomeMsg,
                embedCode: code,
            });

            toast.success('Widget đã được tạo thành công!');
        } catch (err: any) {
            console.error('Create widget failed:', err);
            toast.error(err?.response?.data?.message || 'Không thể tạo widget');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = async () => {
        const success = await copyToClipboard(embedCode);
        if (success) {
            toast.success('Đã copy mã nhúng!');
        } else {
            toast.error('Không thể copy. Vui lòng copy thủ công.');
        }
    };

    const handleOpenTest = () => {
        if (testUrl) {
            window.open(testUrl, '_blank');
        }
    };

    const handleContinue = () => {
        if (!widgetCreated) {
            toast.error('Vui lòng tạo widget trước khi tiếp tục');
            return;
        }
        onboarding.nextStep();
    };

    const handleBack = () => {
        onboarding.prevStep();
    };

    return (
        <>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                Cài đặt Live Chat Widget
            </h1>
            <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
                Thêm widget lên website để bắt đầu nhận hội thoại. Bạn có thể thay đổi
                cài đặt sau trong phần Widget.
            </p>

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                {/* Domain List */}
                <div className="space-y-3">
                    <label
                        className="block text-sm font-semibold text-neutral-700"
                        htmlFor="domainInput"
                    >
                        Website / Domain
                    </label>
                    <div className="flex gap-2">
                        <input
                            className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-3 placeholder-neutral-400 transition-all text-neutral-900"
                            id="domainInput"
                            placeholder="example.com"
                            type="text"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                        />
                        <button
                            className="flex-shrink-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            type="button"
                            onClick={addDomain}
                        >
                            <span className="material-symbols-outlined text-[20px] mr-1">add</span>
                            Thêm
                        </button>
                    </div>
                    <p className="text-xs text-neutral-400">
                        Chỉ những domain trong danh sách mới được phép nhúng widget. Hỗ trợ
                        localhost cho dev.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {domains.map((domain) => (
                            <span
                                key={domain}
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200"
                            >
                                {domain}
                                <button
                                    className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-neutral-400 hover:bg-neutral-200 hover:text-neutral-500 focus:outline-none transition-colors"
                                    type="button"
                                    onClick={() => removeDomain(domain)}
                                >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-neutral-100" />

                {/* Widget Settings */}
                <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-1">
                                Tên widget
                            </label>
                            <input
                                className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 text-neutral-900"
                                placeholder="Nemark Support"
                                type="text"
                                value={widgetName}
                                onChange={(e) => setWidgetName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-neutral-700 mb-1">
                                Vị trí hiển thị
                            </label>
                            <select
                                className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 pl-3 pr-10 text-neutral-900"
                                value={position}
                                onChange={(e) => setPosition(e.target.value as 'br' | 'bl')}
                            >
                                <option value="br">Góc phải dưới</option>
                                <option value="bl">Góc trái dưới</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-1">
                            Màu chủ đạo
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                className="h-9 w-9 p-0.5 rounded border border-neutral-200 cursor-pointer shadow-sm"
                                type="color"
                                value={mainColor}
                                onChange={(e) => setMainColor(e.target.value)}
                            />
                            <input
                                className="block w-32 rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 font-mono text-neutral-600 uppercase"
                                type="text"
                                value={mainColor}
                                onChange={(e) => handleColorChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-1">
                            Tin nhắn chào
                        </label>
                        <textarea
                            className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 text-neutral-900"
                            placeholder="Xin chào! Nemark có thể hỗ trợ gì cho bạn?"
                            rows={2}
                            value={welcomeMsg}
                            onChange={(e) => setWelcomeMsg(e.target.value)}
                        />
                    </div>

                    {/* Preview */}
                    <div className="border border-neutral-200 bg-neutral-50 rounded-lg h-32 relative overflow-hidden flex items-end justify-end p-4">
                        <div className="absolute top-2 left-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                            Preview
                        </div>
                        <div className="relative group cursor-default">
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border border-white rounded-full z-10" />
                            <div
                                className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: mainColor }}
                            >
                                <span className="material-symbols-outlined text-[24px]">chat_bubble</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-neutral-100" />

                {/* Create Widget Button */}
                <div className="space-y-4">
                    <button
                        className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all w-full sm:w-auto justify-center disabled:opacity-50"
                        type="button"
                        onClick={handleCreateWidget}
                        disabled={isLoading || widgetCreated}
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Đang tạo...
                            </>
                        ) : widgetCreated ? (
                            <>
                                <span className="material-symbols-outlined text-[20px] text-green-600">check_circle</span>
                                Widget đã tạo
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[20px]">code</span>
                                Lưu & tạo mã nhúng
                            </>
                        )}
                    </button>

                    {/* Embed Code Block */}
                    {embedCode && (
                        <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-0 overflow-hidden relative group">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    className="inline-flex items-center px-2.5 py-1.5 border border-neutral-300 shadow-sm text-xs font-medium rounded text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none"
                                    title="Sao chép"
                                    type="button"
                                    onClick={handleCopyCode}
                                >
                                    <span className="material-symbols-outlined text-[16px] mr-1">content_copy</span>
                                    Copy
                                </button>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <code className="text-xs font-mono text-neutral-600 whitespace-pre block">
                                    {embedCode}
                                </code>
                            </div>
                        </div>
                    )}
                </div>

                {/* Test URL */}
                <div className="space-y-3 pt-2">
                    <label className="block text-sm font-semibold text-neutral-700">
                        Test trên website
                    </label>
                    <div className="flex gap-2">
                        <input
                            className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-3 placeholder-neutral-400 transition-all text-neutral-900"
                            placeholder="https://example.com"
                            type="text"
                            value={testUrl}
                            onChange={(e) => setTestUrl(e.target.value)}
                        />
                        <button
                            className="flex-shrink-0 inline-flex items-center px-4 py-2 border border-neutral-300 text-sm font-medium rounded-lg shadow-sm text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            type="button"
                            onClick={handleOpenTest}
                            disabled={!testUrl}
                        >
                            <span className="material-symbols-outlined text-[20px] mr-1">open_in_new</span>
                            Mở trang test
                        </button>
                    </div>
                    <p className="text-xs text-neutral-400 italic">
                        Widget sẽ xuất hiện sau khi bạn dán script vào website.
                    </p>
                </div>

                {/* Navigation */}
                <div className="pt-4 flex flex-col gap-3">
                    <button
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-50"
                        type="button"
                        onClick={handleContinue}
                        disabled={!widgetCreated}
                    >
                        Tiếp tục
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                    <button
                        className="w-full flex justify-center items-center py-2 px-4 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                        type="button"
                        onClick={handleBack}
                    >
                        Quay lại
                    </button>
                </div>
            </form>
        </>
    );
};

export default Step3WidgetSetup;
