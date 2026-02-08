import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { UseOnboardingReturn } from '@/hooks/useOnboarding';
import { InboxSettings, DEFAULT_INBOX_SETTINGS } from '@/types/onboarding';

interface Step4Props {
    onboarding: UseOnboardingReturn;
}

// Toggle Switch Component
const ToggleSwitch: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
    size?: 'sm' | 'md';
}> = ({ checked, onChange, size = 'md' }) => {
    const sizeClasses = size === 'sm'
        ? 'h-5 w-9'
        : 'h-6 w-11';
    const dotClasses = size === 'sm'
        ? 'h-4 w-4'
        : 'h-5 w-5';
    const translateClass = size === 'sm'
        ? (checked ? 'translate-x-4' : 'translate-x-0')
        : (checked ? 'translate-x-5' : 'translate-x-0');

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`${sizeClasses} ${checked ? 'bg-primary-600' : 'bg-neutral-200'
                } relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2`}
        >
            <span
                aria-hidden="true"
                className={`${dotClasses} ${translateClass} pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
            />
        </button>
    );
};

export const Step4InboxSettings: React.FC<Step4Props> = ({ onboarding }) => {
    const [settings, setSettings] = useState<InboxSettings>(
        onboarding.inboxSettings || DEFAULT_INBOX_SETTINGS
    );

    // Update local setting
    const updateSetting = <K extends keyof InboxSettings>(
        key: K,
        value: InboxSettings[K]
    ) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    // Update nested setting
    const updateNestedSetting = <
        K extends keyof InboxSettings,
        NK extends keyof InboxSettings[K]
    >(
        key: K,
        nestedKey: NK,
        value: InboxSettings[K][NK]
    ) => {
        setSettings((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] as object),
                [nestedKey]: value,
            },
        }));
    };

    const handleSave = () => {
        // Save to onboarding state (which persists to localStorage)
        onboarding.setInboxSettings(settings);
        toast.success('Đã lưu cài đặt!');
        onboarding.nextStep();
    };

    const handleBack = () => {
        onboarding.prevStep();
    };

    return (
        <>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                Thiết lập Inbox để vận hành
            </h1>
            <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
                Thiết lập phân công và thông báo để xử lý hội thoại nhanh và không bỏ
                sót. Bạn có thể chỉnh sau trong Cài đặt.
            </p>

            <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                {/* Assignment Mode */}
                <div className="space-y-4">
                    <label className="block text-sm font-semibold text-neutral-700">
                        Cách phân công
                    </label>
                    <div className="space-y-3">
                        {/* Auto Assignment */}
                        <div
                            className={`border rounded-lg p-4 transition-all cursor-pointer ${settings.assignmentMode === 'auto'
                                    ? 'border-primary-500 bg-primary-50/20'
                                    : 'border-neutral-200 hover:bg-neutral-50'
                                }`}
                            onClick={() => updateSetting('assignmentMode', 'auto')}
                        >
                            <div className="flex items-start">
                                <div className="flex h-5 items-center">
                                    <input
                                        type="radio"
                                        checked={settings.assignmentMode === 'auto'}
                                        onChange={() => updateSetting('assignmentMode', 'auto')}
                                        className="h-4 w-4 border-neutral-300 text-primary-600 focus:ring-primary-600"
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label className="font-medium text-neutral-900">
                                        Tự động phân công
                                    </label>
                                    <p className="text-neutral-500 mt-0.5">
                                        Hệ thống tự chia hội thoại cho agent đang online.
                                    </p>
                                </div>
                            </div>

                            {settings.assignmentMode === 'auto' && (
                                <div className="ml-7 mt-4 space-y-3 pl-3 border-l-2 border-neutral-100">
                                    <div className="w-full sm:w-2/3">
                                        <label className="block text-xs font-medium text-neutral-600 mb-1">
                                            Chiến lược
                                        </label>
                                        <select
                                            value={settings.strategy}
                                            onChange={(e) =>
                                                updateSetting(
                                                    'strategy',
                                                    e.target.value as 'round-robin' | 'least-busy'
                                                )
                                            }
                                            className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm py-2"
                                        >
                                            <option value="round-robin">Round-robin (Chia đều)</option>
                                            <option value="least-busy">Ít hội thoại nhất</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-neutral-600">
                                            Chỉ phân công cho agent đang Online
                                        </span>
                                        <ToggleSwitch
                                            size="sm"
                                            checked={settings.onlineOnly}
                                            onChange={(v) => updateSetting('onlineOnly', v)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-neutral-600">
                                            Tự gán lại khi agent offline
                                        </span>
                                        <ToggleSwitch
                                            size="sm"
                                            checked={settings.reassignOnOffline}
                                            onChange={(v) => updateSetting('reassignOnOffline', v)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Manual Assignment */}
                        <div
                            className={`border rounded-lg p-4 transition-all cursor-pointer ${settings.assignmentMode === 'manual'
                                    ? 'border-primary-500 bg-primary-50/20'
                                    : 'border-neutral-200 hover:bg-neutral-50'
                                }`}
                            onClick={() => updateSetting('assignmentMode', 'manual')}
                        >
                            <div className="flex items-start">
                                <div className="flex h-5 items-center">
                                    <input
                                        type="radio"
                                        checked={settings.assignmentMode === 'manual'}
                                        onChange={() => updateSetting('assignmentMode', 'manual')}
                                        className="h-4 w-4 border-neutral-300 text-primary-600 focus:ring-primary-600"
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label className="font-medium text-neutral-900">
                                        Phân công thủ công
                                    </label>
                                    <p className="text-neutral-500 mt-0.5">
                                        Quản lý tự gán agent cho từng hội thoại.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-neutral-100" />

                {/* Working Hours */}
                <div className="space-y-4">
                    <label className="block text-sm font-semibold text-neutral-700">
                        Giờ làm việc
                    </label>
                    <div className="grid grid-cols-1 gap-4">
                        <select
                            value={settings.workingHours.type}
                            onChange={(e) =>
                                updateNestedSetting(
                                    'workingHours',
                                    'type',
                                    e.target.value as 'business' | '24/7' | 'custom'
                                )
                            }
                            className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-3 text-neutral-900"
                        >
                            <option value="business">Giờ hành chính (09:00–18:00)</option>
                            <option value="24/7">24/7</option>
                            <option value="custom">Tùy chỉnh</option>
                        </select>

                        <textarea
                            className="block w-full rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2 px-3 placeholder-neutral-400 text-neutral-900 resize-none"
                            placeholder="Hiện tại chúng tôi đang ngoài giờ làm việc. Bạn để lại lời nhắn, chúng tôi sẽ phản hồi sớm nhất."
                            rows={3}
                            value={settings.afterHoursMessage}
                            onChange={(e) => updateSetting('afterHoursMessage', e.target.value)}
                        />
                    </div>
                </div>

                <hr className="border-neutral-100" />

                {/* Notifications */}
                <div className="space-y-4">
                    <div className="flex justify-between items-baseline">
                        <label className="block text-sm font-semibold text-neutral-700">
                            Thông báo
                        </label>
                        <span className="text-xs text-neutral-400">
                            Tùy chỉnh chi tiết trong Cài đặt
                        </span>
                    </div>
                    <div className="space-y-3 bg-neutral-50 p-4 rounded-lg border border-neutral-100">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral-700">
                                Thông báo khi có hội thoại mới
                            </span>
                            <ToggleSwitch
                                size="sm"
                                checked={settings.notifications.newConversation}
                                onChange={(v) =>
                                    updateNestedSetting('notifications', 'newConversation', v)
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral-700">
                                Thông báo khi được gán hội thoại
                            </span>
                            <ToggleSwitch
                                size="sm"
                                checked={settings.notifications.assigned}
                                onChange={(v) =>
                                    updateNestedSetting('notifications', 'assigned', v)
                                }
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral-700">Âm thanh thông báo</span>
                            <ToggleSwitch
                                size="sm"
                                checked={settings.notifications.sound}
                                onChange={(v) => updateNestedSetting('notifications', 'sound', v)}
                            />
                        </div>
                    </div>
                </div>

                <hr className="border-neutral-100" />

                {/* Reminder */}
                <div className="space-y-4">
                    <label className="block text-sm font-semibold text-neutral-700">
                        Nhắc phản hồi
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <select
                            value={settings.reminderMinutes}
                            onChange={(e) =>
                                updateSetting('reminderMinutes', parseInt(e.target.value))
                            }
                            className="block w-full sm:w-1/2 rounded-lg border-neutral-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-3 text-neutral-900"
                        >
                            <option value={2}>Nhắc sau 2 phút</option>
                            <option value={5}>Nhắc sau 5 phút</option>
                            <option value={0}>Tắt</option>
                            <option value={10}>Nhắc sau 10 phút</option>
                        </select>
                        <span className="text-xs text-neutral-400">
                            Giúp tránh bỏ sót hội thoại chưa được phản hồi.
                        </span>
                    </div>
                </div>

                {/* Summary Bar */}
                <div className="mt-6 bg-neutral-50 border border-neutral-200 rounded-lg p-4 flex flex-col gap-2 sm:flex-row sm:gap-6 text-xs text-neutral-600">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary-600">
                            assignment_ind
                        </span>
                        <span>
                            Phân công:{' '}
                            <strong>
                                {settings.assignmentMode === 'auto' ? 'Tự động' : 'Thủ công'}
                            </strong>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary-600">
                            schedule
                        </span>
                        <span>
                            Giờ làm:{' '}
                            <strong>
                                {settings.workingHours.type === 'business'
                                    ? '09:00–18:00'
                                    : settings.workingHours.type === '24/7'
                                        ? '24/7'
                                        : 'Tùy chỉnh'}
                            </strong>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary-600">
                            notifications_active
                        </span>
                        <span>
                            Thông báo:{' '}
                            <strong>
                                {settings.notifications.newConversation ? 'Bật' : 'Tắt'}
                            </strong>
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <div className="pt-2 flex flex-col gap-4">
                    <button
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
                        type="button"
                        onClick={handleSave}
                    >
                        Lưu & tiếp tục
                        <span className="material-symbols-outlined text-[18px]">
                            arrow_forward
                        </span>
                    </button>
                    <div className="flex flex-col items-center gap-3">
                        <button
                            className="text-sm font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
                            type="button"
                            onClick={handleBack}
                        >
                            Quay lại
                        </button>
                        <p className="text-center text-xs text-neutral-400">
                            Bạn có thể thay đổi toàn bộ thiết lập này sau trong Cài đặt Inbox.
                        </p>
                    </div>
                </div>
            </form>
        </>
    );
};

export default Step4InboxSettings;
