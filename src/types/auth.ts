import { Workspace } from './workspace';

export interface User {
  UserKey: string;
  UserId: string;
  Email: string;
  EmailNormalized?: string;
  EmailVerified: boolean;
  DisplayName: string;
  FirstName?: string;
  LastName?: string;
  AvatarUrl?: string;
  Language?: string;
  Timezone?: string;
  Status?: number;
  CreatedAt?: string;
  UpdatedAt?: string;
  IsSystemAdmin?: boolean;
}

export interface ProfileData {
  user: User;
  workspaces: Workspace[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface LoginRequest {
  email?: string;
  password?: string;
}

export interface RegisterRequest {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  inviteToken?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface ForgotPasswordRequest {
  email?: string;
  password?: string;
}

export interface ResetPasswordRequest {
  token?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface Session {
  RefreshTokenKey: string;
  UserAgent?: string;
  CreatedByIp?: string;
  CreatedAt?: string;
  ExpiresAt?: string;
}

export interface SessionListResponse {
  sessions: Session[];
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  language?: string;
  timezone?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

