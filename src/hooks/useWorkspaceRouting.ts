import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from './useAuth';
import { useOnboardingStatus } from './useOnboardingAPI';

/**
 * Workspace Routing Hook
 * Auto-redirects users based on workspace status:
 * - No/DRAFT workspace → /onboarding
 * - ACTIVE workspace → block /onboarding access
 */
export const useWorkspaceRouting = () => {
    const router = useRouter();
    const { data: user, isLoading: userLoading } = useUser();
    const { data: onboardingStatus, isLoading: statusLoading } = useOnboardingStatus({
        enabled: !!user, // Only fetch if logged in
    });

    useEffect(() => {
        // Wait for data to load
        if (userLoading || statusLoading) return;

        // Not logged in - auth redirect will handle
        if (!user) return;

        const isOnboardingPage = router.pathname.startsWith('/onboarding');
        const isAuthPage = router.pathname.startsWith('/auth');
        const isProfilePage = router.pathname.startsWith('/profile');
        const isPublicPage = router.pathname === '/' || router.pathname.startsWith('/widget');

        // Skip redirect for these pages
        if (isProfilePage || isPublicPage) return;

        if (onboardingStatus) {
            // Case 1: User needs onboarding but not on onboarding page
            if (onboardingStatus.needsOnboarding && !isOnboardingPage) {
                console.log('[WorkspaceRouting] Redirecting to onboarding (no ACTIVE workspace)');
                router.push('/onboarding?step=1');
                return;
            }

            // Case 2: User has ACTIVE workspace but trying to access onboarding OR auth pages
            if (!onboardingStatus.needsOnboarding && (isOnboardingPage || isAuthPage)) {
                console.log('[WorkspaceRouting] Redirecting to inbox (has ACTIVE workspace)');
                router.push('/workspace/inbox');
                return;
            }
        }
    }, [user, userLoading, onboardingStatus, statusLoading, router.pathname]);
};
