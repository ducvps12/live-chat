import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingService, OnboardingStatus } from '@/services/onboarding.service';
import { message } from 'antd';
import { useRouter } from 'next/router';

/**
 * Hooks for onboarding API calls
 * Separate from useOnboarding (localStorage-based wizard state)
 */

export const ONBOARDING_API_KEYS = {
    status: ['onboarding', 'status'] as const,
};

/**
 * Check onboarding status from backend
 * Returns: needsOnboarding, hasActiveWorkspace, draftWorkspace
 */
export const useOnboardingStatus = (options: any = {}) => {
    return useQuery<OnboardingStatus>({
        queryKey: ONBOARDING_API_KEYS.status,
        queryFn: onboardingService.checkStatus,
        staleTime: 1000 * 60, // 1 minute
        retry: 1,
        refetchOnWindowFocus: false,
        ...options,
    });
};

/**
 * Complete onboarding (activate workspace)
 */
export const useCompleteOnboarding = () => {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: onboardingService.completeOnboarding,
        onSuccess: () => {
            message.success('🎉 Workspace đã được kích hoạt thành công!');

            // Invalidate relevant queries
            queryClient.invalidateQueries({ queryKey: ONBOARDING_API_KEYS.status });
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });

            // Redirect to inbox
            setTimeout(() => {
                router.push('/workspace/inbox');
            }, 500);
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.message || 'Không thể hoàn tất onboarding';
            message.error(errorMsg);
            console.error('[Onboarding] Complete failed:', error);
        },
    });
};
