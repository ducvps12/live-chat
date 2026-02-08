import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useOnboarding } from '@/hooks/useOnboarding';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
    Step1CreateWorkspace,
    Step2InviteMembers,
    Step3WidgetSetup,
    Step4InboxSettings,
    Step5Complete,
} from '@/components/pages/onboarding';

const STEP_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: 'Tạo Workspace',
    2: 'Mời thành viên',
    3: 'Cài Widget',
    4: 'Thiết lập Inbox',
    5: 'Hoàn tất',
};

export default function OnboardingPage() {
    const router = useRouter();
    const onboarding = useOnboarding();

    // Handle step from URL query
    useEffect(() => {
        if (!onboarding.isLoaded) return;

        const stepFromUrl = parseInt(router.query.step as string);
        if (stepFromUrl && stepFromUrl >= 1 && stepFromUrl <= 5) {
            // Validate can proceed to this step
            if (onboarding.canProceedToStep(stepFromUrl as 1 | 2 | 3 | 4 | 5)) {
                onboarding.setStep(stepFromUrl as 1 | 2 | 3 | 4 | 5);
            } else {
                // Redirect to appropriate step
                router.replace(`/onboarding?step=${onboarding.step}`, undefined, {
                    shallow: true,
                });
            }
        }
    }, [router.query.step, onboarding.isLoaded]);

    // Update URL when step changes
    useEffect(() => {
        if (!onboarding.isLoaded) return;

        const currentUrlStep = parseInt(router.query.step as string);
        if (currentUrlStep !== onboarding.step) {
            router.replace(`/onboarding?step=${onboarding.step}`, undefined, {
                shallow: true,
            });
        }
    }, [onboarding.step, onboarding.isLoaded]);

    // Redirect to step 1 if no workspace at step 2+
    useEffect(() => {
        if (!onboarding.isLoaded) return;

        if (onboarding.step >= 2 && !onboarding.workspace) {
            onboarding.setStep(1);
        }
    }, [onboarding.step, onboarding.workspace, onboarding.isLoaded]);

    // Loading state
    if (!onboarding.isLoaded) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
                        <p className="text-neutral-500 text-sm">Đang tải...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Render current step
    const renderStep = () => {
        switch (onboarding.step) {
            case 1:
                return <Step1CreateWorkspace onboarding={onboarding} />;
            case 2:
                return <Step2InviteMembers onboarding={onboarding} />;
            case 3:
                return <Step3WidgetSetup onboarding={onboarding} />;
            case 4:
                return <Step4InboxSettings onboarding={onboarding} />;
            case 5:
                return <Step5Complete onboarding={onboarding} />;
            default:
                return <Step1CreateWorkspace onboarding={onboarding} />;
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto">
                {/* Progress Bar Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-3">
                        <span className="text-sm font-bold text-neutral-800">
                            Bước {onboarding.step} / 5
                        </span>
                        <span className="text-xs font-medium text-neutral-400">
                            {STEP_LABELS[onboarding.step]}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div
                                key={s}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${s <= onboarding.step ? 'bg-primary-600' : 'bg-neutral-200'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Step Content Card */}
                <div className="bg-white rounded-xl shadow-card border border-neutral-200 p-8 sm:p-10 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
                    {renderStep()}
                </div>
            </div>
        </DashboardLayout>
    );
}
