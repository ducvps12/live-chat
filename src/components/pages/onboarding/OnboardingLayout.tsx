import React from 'react';
import { OnboardingStep } from '@/types/onboarding';

interface OnboardingLayoutProps {
    step: OnboardingStep;
    stepLabel: string;
    children: React.ReactNode;
}

const STEP_LABELS: Record<OnboardingStep, string> = {
    1: 'Tạo Workspace',
    2: 'Mời thành viên',
    3: 'Cài Widget',
    4: 'Thiết lập Inbox',
    5: 'Hoàn tất',
};

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
    step,
    stepLabel,
    children,
}) => {
    return (
        <div className="bg-neutral-50 font-sans text-neutral-900 min-h-screen flex flex-col">
            {/* Header */}
            <header className="flex-shrink-0 w-full px-6 py-6 sm:px-10 flex justify-between items-center bg-transparent z-10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-sm">
                        <span className="material-symbols-outlined text-[22px]">chat_bubble</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight text-neutral-900">
                        Nemark Inbox
                    </span>
                </div>
                <nav>
                    <a
                        className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                        href="#"
                    >
                        Hỗ trợ
                    </a>
                </nav>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16 sm:px-6">
                <div className="w-full max-w-[520px]">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-sm font-bold text-neutral-800">
                                Bước {step} / 5
                            </span>
                            <span className="text-xs font-medium text-neutral-400">
                                {stepLabel || STEP_LABELS[step]}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <div
                                    key={s}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary-600' : 'bg-neutral-200'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Step Content Card */}
                    <div className="bg-white rounded-xl shadow-card border border-neutral-200 p-8 sm:p-10 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default OnboardingLayout;
