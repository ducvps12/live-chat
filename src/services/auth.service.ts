import api from '@/lib/http';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  LogoutRequest,
  User,
  Session,
  ProfileData,
  VerifyEmailRequest,
  ResendVerificationRequest,
} from '@/types/auth';
import { ApiResponse } from '@/types/api';

export const AuthService = {
  login: async (data: LoginRequest) => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return response.data.data;
  },

  register: async (data: RegisterRequest) => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return response.data.data;
  },

  logout: async (data: LogoutRequest) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/logout', data);
    return response.data.data;
  },

  logoutAll: async () => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/logout-all');
    return response.data.data;
  },

  me: async () => {
    const response = await api.get<ApiResponse<ProfileData>>('/auth/me');
    return response.data.data;
  },

  refreshToken: async (data: RefreshTokenRequest) => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/refresh', data);
    return response.data.data;
  },

  changePassword: async (data: ChangePasswordRequest) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/change-password', data);
    return response.data.data;
  },

  forgotPassword: async (data: ForgotPasswordRequest) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', data);
    return response.data.data;
  },

  resetPassword: async (data: ResetPasswordRequest) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/reset-password', data);
    return response.data.data;
  },

  verifyEmail: async (data: VerifyEmailRequest) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/verify-email', data);
    return response.data.data;
  },

  resendVerification: async (data: ResendVerificationRequest) => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/resend-verification', data);
    return response.data.data;
  },

  getSessions: async () => {
    const response = await api.get<ApiResponse<{ sessions: Session[] }>>('/auth/sessions');
    return response.data.data.sessions;
  },

  revokeSession: async (sessionId: string) => {
    const response = await api.delete<ApiResponse<{ message: string }>>(`/auth/sessions/${sessionId}`);
    return response.data.data;
  },
};
