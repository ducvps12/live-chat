import React, { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/router';
import { UseOnboardingReturn } from '@/hooks/useOnboarding';
import { copyToClipboard } from '@/utils/onboarding';

interface Step5Props {
    onboarding: UseOnboardingReturn;
}

export const Step5Complete: React.FC<Step5Props> = ({ onboarding }) => {
    const router = useRouter();
    const [testUrl, setTestUrl] = useState('');

    const workspace = onboarding.workspace;
    const widget = onboarding.widget;
    const invitesSent = onboarding.invites.sent.length;

    const handleCopyEmbed = async () => {
        if (widget?.embedCode) {
            const success = await copyToClipboard(widget.embedCode);
            if (success) {
                toast.success('Đã copy mã nhúng!');
            } else {
                toast.error('Không thể copy');
            }
        }
    };

    const handleGoToInbox = () => {
        // Clear onboarding state
        onboarding.reset();
        // Navigate to inbox with workspace context
        router.push(`/workspace/inbox?workspaceId=${workspace?.workspaceId}`);
    };

    const handleSendTestMessage = () => {
        if (testUrl) {
            window.open(testUrl, '_blank');
        } else {
            toast.info('Nhập URL website của bạn để test');
        }
    };

    const handleBack = () => {
        onboarding.prevStep();
    };

    return (
        <>
            {/* Success Header */}
            <div className="flex flex-col items-center text-center mb-6 mt-2">
                <div className="h-12 w-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-4 ring-4 ring-white shadow-sm border border-primary-100">
                    <span className="material-symbols-outlined">celebration</span>
                </div>
                <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                    Hoàn tất thiết lập 🎉
                </h1>
                <p className="text-neutral-500 text-sm leading-relaxed">
                    Workspace của bạn đã sẵn sàng. Bây giờ bạn có thể vào Inbox để nhận và
                    xử lý hội thoại đầu tiên.
                </p>
            </div>

            <div className="space-y-6">
                {/* Summary Card */}
                <div className="border border-neutral-200 bg-neutral-50 rounded-lg p-4">
                    <h3 className="text-sm font-bold text-neutral-800 mb-3">
                        Tóm tắt cấu hình
                    </h3>
                    <ul className="space-y-3">
                        <li className="flex items-start justify-between text-sm">
                            <div className="flex items-center gap-2 text-neutral-700">
                                <span className="material-symbols-outlined text-primary-600 text-[20px]">
                                    check_circle
                                </span>
                                <span>
                                    Workspace đã tạo:{' '}
                                    <strong>{workspace?.name || 'N/A'}</strong>
                                </span>
                            </div>
                        </li>
                        <li className="flex items-start justify-between text-sm">
                            <div className="flex items-center gap-2 text-neutral-700">
                                <span className="material-symbols-outlined text-primary-600 text-[20px]">
                                    check_circle
                                </span>
                                <span>
                                    Đã mời thành viên:{' '}
                                    <strong>{invitesSent > 0 ? `${invitesSent} người` : 'Bỏ qua'}</strong>
                                </span>
                            </div>
                        </li>
                        <li className="flex items-start justify-between text-sm">
                            <div className="flex items-center gap-2 text-neutral-700">
                                <span className="material-symbols-outlined text-primary-600 text-[20px]">
                                    check_circle
                                </span>
                                <span>
                                    Widget:{' '}
                                    <strong>{widget ? 'Đã sẵn sàng nhúng' : 'Chưa tạo'}</strong>
                                </span>
                            </div>
                        </li>
                        <li className="flex items-start justify-between text-sm">
                            <div className="flex items-center gap-2 text-neutral-700">
                                <span className="material-symbols-outlined text-primary-600 text-[20px]">
                                    check_circle
                                </span>
                                <span>
                                    Inbox: <strong>Đã được thiết lập</strong>
                                </span>
                            </div>
                        </li>
                    </ul>
                </div>

                {/* Embed Code */}
                {widget?.embedCode && (
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-700 mb-2">
                            Mã nhúng widget
                        </h3>
                        <div className="relative group">
                            <div className="bg-white rounded-lg border border-neutral-200 p-3 flex items-start">
                                <code
                                    className="text-xs font-mono text-neutral-600 overflow-x-auto whitespace-pre block w-full pr-8"
                                    style={{ scrollbarWidth: 'none' }}
                                >
                                    {widget.embedCode}
                                </code>
                                <button
                                    className="absolute top-2 right-2 p-1.5 text-neutral-400 hover:text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-md transition-colors border border-transparent hover:border-neutral-200"
                                    title="Copy code"
                                    onClick={handleCopyEmbed}
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        content_copy
                                    </span>
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-neutral-400">
                                Dán đoạn code này trước thẻ{' '}
                                <code className="bg-neutral-100 px-1 py-0.5 rounded border border-neutral-200">
                                    &lt;/body&gt;
                                </code>{' '}
                                trên website của bạn.
                            </p>
                        </div>
                    </div>
                )}

                {/* Test URL */}
                <div>
                    <h3 className="text-sm font-semibold text-neutral-700 mb-2">
                        Test nhanh
                    </h3>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 placeholder-neutral-400 transition-all"
                                placeholder="https://example.com"
                                type="text"
                                value={testUrl}
                                onChange={(e) => setTestUrl(e.target.value)}
                            />
                        </div>
                        <button
                            className="inline-flex items-center px-3 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-lg text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            type="button"
                            onClick={handleSendTestMessage}
                        >
                            <span className="material-symbols-outlined text-[18px] mr-1">
                                open_in_new
                            </span>
                            Mở trang test
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400">
                        Nếu bạn đang dev local, hãy thêm localhost vào danh sách domain ở
                        Bước 3.
                    </p>
                </div>

                {/* CTAs */}
                <div className="pt-2 space-y-3 border-t border-neutral-100 mt-4">
                    <button
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
                        type="button"
                        onClick={handleGoToInbox}
                    >
                        <span className="material-symbols-outlined text-[20px]">inbox</span>
                        Vào Inbox
                    </button>
                    <button
                        className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-neutral-300 rounded-lg shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
                        type="button"
                        onClick={handleSendTestMessage}
                    >
                        <span className="material-symbols-outlined text-[18px]">chat</span>
                        Gửi tin nhắn test
                    </button>
                    <p className="text-center text-xs text-neutral-400 pt-1">
                        Mẹo: Tạo một cuộc trò chuyện test từ website để kiểm tra trạng thái
                        delivered/seen.
                    </p>
                </div>
            </div>

            {/* Back & Help */}
            <div className="mt-8 flex items-center justify-between px-1">
                <button
                    className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5 py-2 px-2 -ml-2 rounded-md hover:bg-neutral-100/50"
                    onClick={handleBack}
                >
                    <span className="material-symbols-outlined text-[18px]">
                        arrow_back
                    </span>
                    Quay lại
                </button>
                <a
                    className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5 py-2 px-2 -mr-2 rounded-md hover:bg-neutral-100/50"
                    href="#"
                >
                    Xem hướng dẫn
                    <span className="material-symbols-outlined text-[18px]">help</span>
                </a>
            </div>
        </>
    );
};

export default Step5Complete;
