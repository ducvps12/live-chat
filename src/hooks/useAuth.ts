import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthService } from '@/services/auth.service';
import {
  LoginRequest,
  RegisterRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ProfileData,
  User,
  Session
} from '@/types/auth';
import { useRouter, NextRouter } from 'next/router';
import { message } from 'antd';
import { useEffect } from 'react';
import { Workspace } from '@/types/workspace';
import { onboardingService } from '@/services/onboarding.service';

export const AUTH_KEYS = {
  user: ['auth', 'user'] as const,
  sessions: ['auth', 'sessions'] as const,
};

export const useUser = () => {
  return useQuery({
    queryKey: AUTH_KEYS.user,
    queryFn: AuthService.me,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('auth_token'),
  });
};

export const useLogin = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: AuthService.login,
    onSuccess: async (data) => {
      console.log('Login successful, received data:', data);
      if (!data.accessToken) {
        console.error('Login response missing accessToken!', data);
      }
      localStorage.setItem('auth_token', JSON.stringify({
        code: data.accessToken,
        time: new Date().toISOString()
      }));
      if (data.refreshToken) {
        localStorage.setItem('refresh_token', data.refreshToken);
      }
      message.success('Login successfully');

      // Invalidate user query to trigger useWorkspaceRouting
      await queryClient.invalidateQueries({ queryKey: AUTH_KEYS.user });

      // Check if there's a redirect query param (e.g., from invite flow)
      const { redirect } = router.query;

      if (redirect) {
        // Redirect back to invite accept page
        let redirectUrl = decodeURIComponent(redirect as string);
        if (redirectUrl.includes('?')) {
          redirectUrl += '&from_login=true';
        } else {
          redirectUrl += '?from_login=true';
        }
        console.log('[useLogin] Redirecting to invite accept (Hard Reload):', redirectUrl);
        // Force hard reload to ensure MyStoreContext re-fetches user
        window.location.href = redirectUrl;
        return;
      }

      // Normal login flow: Check onboarding status
      try {
        const status = await onboardingService.checkStatus();
        if (status.needsOnboarding) {
          router.push('/onboarding?step=1');
        } else {
          router.push('/workspace/inbox');
        }
      } catch (e) {
        router.push('/workspace/inbox');
      }
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Login failed');
    }
  });
};

export const useRegister = () => {
  const router = useRouter();

  const { invite_token } = router.query;

  return useMutation({
    mutationFn: (data: RegisterRequest) => {
      // If invite_token exists in URL, append it to the request data
      if (invite_token) {
        return AuthService.register({
          ...data,
          inviteToken: invite_token as string
        });
      }
      return AuthService.register(data);
    },
    onSuccess: (data: any) => {
      // Check for auto-login tokens (from invite flow)
      if (data && data.accessToken) {
        console.log('[Register] Auto-login successful');
        localStorage.setItem('auth_token', JSON.stringify({
          code: data.accessToken,
          time: new Date().toISOString()
        }));
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
        message.success('Account created and logged in!');
      } else {
        message.success('Registration successful.');
      }

      // Check if this is from invite flow
      const { invite_token } = router.query;

      if (invite_token) {
        // let RegisterPage handle the redirect OR if auto-login, we could redirect here?
        // RegisterPage has logic to redirect to /invites/accept.
        // We just need to ensure tokens are saved first (done above).
        return;
      }

      // Normal registration flow (only if not auto-logged in, though current logic only auto-logs in for invites)
      if (!(data && data.accessToken)) {
        message.info('Please login.');
        router.push('/auth/login');
      } else {
        // If auto-logged in (future proofing), redirect to dashboard
        router.push('/workspace/inbox');
      }
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Registration failed');
    }
  });
};

export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await AuthService.logout({ refreshToken });
      }
    },
    onSettled: () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('last_workspace_id');
      queryClient.clear();
      router.push('/auth/login');
    },
  });
};

export const useLogoutAll = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: AuthService.logoutAll,
    onSuccess: () => {
      message.success('Logged out from all devices');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('last_workspace_id');
      queryClient.clear();
      router.push('/auth/login');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Logout all failed');
    }
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: AuthService.changePassword,
    onSuccess: () => {
      message.success('Password changed successfully');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Change password failed');
    }
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: AuthService.forgotPassword,
    onSuccess: () => {
      message.success('Password reset email sent');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Request failed');
    }
  });
};

export const useResetPassword = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: AuthService.resetPassword,
    onSuccess: () => {
      message.success('Password reset successfully. Please login.');
      router.push('/auth/login');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Reset password failed');
    }
  });
};

export const useSessions = () => {
  return useQuery({
    queryKey: AUTH_KEYS.sessions,
    queryFn: AuthService.getSessions,
  });
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: AuthService.revokeSession,
    onSuccess: () => {
      message.success('Session revoked');
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.sessions });
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Revoke session failed');
    }
  });
};

export const useVerifyEmail = () => {
  const router = useRouter();
  return useMutation({
    mutationFn: AuthService.verifyEmail,
    onSuccess: () => {
      message.success('Email verified successfully. Please login.');
      router.push('/auth/login');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Verification failed');
    }
  });
};

export const useResendVerification = () => {
  return useMutation({
    mutationFn: AuthService.resendVerification,
    onSuccess: () => {
      message.success('Verification email sent. Please check your inbox.');
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Resend failed');
    }
  });
};

export const useAuth = () => {
  const login = useLogin();
  const register = useRegister();
  const logout = useLogout();
  const user = useUser();
  const queryClient = useQueryClient();

  // Function to login with tokens (for OAuth flows)
  const loginWithTokens = async (accessToken: string, refreshToken: string) => {
    localStorage.setItem('auth_token', JSON.stringify({
      code: accessToken,
      time: new Date().toISOString()
    }));
    localStorage.setItem('refresh_token', refreshToken);

    // Invalidate user query to trigger refetch
    await queryClient.invalidateQueries({ queryKey: AUTH_KEYS.user });
  };

  return {
    login,
    register,
    logout,
    user,
    loginWithTokens,
    isLoading: login.isPending || register.isPending || logout.isPending,
    isAuthenticated: !!user.data,
  };
};

export const useAuthRedirect = () => {
  const { data: response, isLoading } = useUser();
  const router = useRouter();
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token');

  useEffect(() => {
    if (isLoading) return;

    const path = router.pathname;

    // Protected Routes (Require auth)
    const isProtected = path.startsWith('/workspace') || path.startsWith('/onboarding') || path.startsWith('/profile') || path.startsWith('/admin');

    if (!hasToken && isProtected) {
      router.replace('/auth/login');
    }

    // Let useWorkspaceRouting handle workspace-based redirects

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response, isLoading, hasToken, router.pathname]);
};
