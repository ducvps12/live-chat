import { useState, useEffect, useCallback } from 'react';
import {
  OnboardingState,
  OnboardingStep,
  InboxSettings,
  WidgetConfig,
  DEFAULT_ONBOARDING_STATE,
  DEFAULT_INBOX_SETTINGS,
} from '@/types/onboarding';
import { ONBOARDING_STORAGE_KEY, getInboxSettingsKey } from '@/utils/onboarding';

/**
 * Custom hook for managing onboarding state with persistence
 */
export const useOnboarding = () => {
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as OnboardingState;
        setState(parsed);
      }
    } catch (e) {
      console.error('Failed to load onboarding state:', e);
    }
    setIsLoaded(true);
  }, []);

  // Persist state to localStorage on change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save onboarding state:', e);
    }
  }, [state, isLoaded]);

  // Set current step
  const setStep = useCallback((step: OnboardingStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  // Go to next step
  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, 5) as OnboardingStep,
    }));
  }, []);

  // Go to previous step
  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1) as OnboardingStep,
    }));
  }, []);

  // Set workspace after creation
  const setWorkspace = useCallback(
    (workspace: { workspaceId: string; workspaceKey: number; name: string }) => {
      setState((prev) => ({ ...prev, workspace }));
    },
    []
  );

  // Add invite result
  const addInviteResult = useCallback(
    (
      type: 'sent' | 'failed' | 'already',
      email: string,
      reason?: string
    ) => {
      setState((prev) => {
        const invites = { ...prev.invites };
        if (type === 'sent') {
          invites.sent = [...invites.sent, email];
        } else if (type === 'failed') {
          invites.failed = [...invites.failed, { email, reason: reason || 'Unknown error' }];
        } else {
          invites.already = [...invites.already, email];
        }
        return { ...prev, invites };
      });
    },
    []
  );

  // Reset invites
  const resetInvites = useCallback(() => {
    setState((prev) => ({
      ...prev,
      invites: { sent: [], failed: [], already: [] },
    }));
  }, []);

  // Set widget config
  const setWidget = useCallback((widget: WidgetConfig) => {
    setState((prev) => ({ ...prev, widget }));
  }, []);

  // Set inbox settings
  const setInboxSettings = useCallback((settings: InboxSettings) => {
    setState((prev) => {
      // Also save to workspace-specific storage
      if (prev.workspace?.workspaceId && typeof window !== 'undefined') {
        const key = getInboxSettingsKey(prev.workspace.workspaceId);
        localStorage.setItem(key, JSON.stringify(settings));
      }
      return { ...prev, inboxSettings: settings };
    });
  }, []);

  // Reset entire onboarding state
  const reset = useCallback(() => {
    setState(DEFAULT_ONBOARDING_STATE);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  }, []);

  // Check if can proceed to step
  const canProceedToStep = useCallback(
    (targetStep: OnboardingStep): boolean => {
      // Can always go back
      if (targetStep < state.step) return true;

      // Step 2 requires workspace
      if (targetStep >= 2 && !state.workspace) return false;

      // Step 4 requires widget (optional but recommended)
      // if (targetStep >= 4 && !state.widget) return false;

      return true;
    },
    [state]
  );

  return {
    ...state,
    isLoaded,
    setStep,
    nextStep,
    prevStep,
    setWorkspace,
    addInviteResult,
    resetInvites,
    setWidget,
    setInboxSettings,
    reset,
    canProceedToStep,
    defaultInboxSettings: DEFAULT_INBOX_SETTINGS,
  };
};

export type UseOnboardingReturn = ReturnType<typeof useOnboarding>;
