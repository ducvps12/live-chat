import axiosInstance from './axios';

export interface OnboardingStatus {
    needsOnboarding: boolean;
    hasActiveWorkspace: boolean;
    draftWorkspace?: {
        WorkspaceKey: number;
        WorkspaceId: string;
        Name: string;
        Status: number;
        CreatedAt: string;
    } | null;
}

export interface CompleteOnboardingRequest {
    workspaceKey: number;
}

export interface CompleteOnboardingResponse {
    workspaceKey: number;
    status: string;
}

/**
 * Onboarding Service
 * Handles workspace onboarding flow (DRAFT → ACTIVE)
 */
class OnboardingService {
    private baseUrl = '/onboarding';

    /**
     * Check if user needs onboarding
     * Returns: needsOnboarding (boolean), draftWorkspace (if exists)
     */
    async checkStatus(): Promise<OnboardingStatus> {
        const response = await axiosInstance.get<{ data: OnboardingStatus }>(`${this.baseUrl}/status`);
        return response.data.data;
    }

    /**
     * Complete onboarding and activate workspace
     * Requires: workspace has at least 1 widget
     */
    async completeOnboarding(data: CompleteOnboardingRequest): Promise<CompleteOnboardingResponse> {
        const response = await axiosInstance.post<{ data: CompleteOnboardingResponse }>(
            `${this.baseUrl}/complete`,
            data
        );
        return response.data.data;
    }
}

export const onboardingService = new OnboardingService();
export default onboardingService;
