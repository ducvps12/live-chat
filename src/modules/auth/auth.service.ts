import crypto from 'crypto';
import { userRepo } from './repos/user.repo';
import { sessionRepo } from './repos/session.repo';
import { security } from '../../infra/security';
import { AppError } from '../../middlewares/errorHandler';
import { env } from '../../config/env';
import { smtpService } from '../email/smtp.service';

export const authService = {
    async register(email: string, password: string, name: string) {
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await userRepo.findByEmail(normalizedEmail);
        if (existing) throw new AppError('Tài khoản đã tồn tại', 409, 'ALREADY_EXISTS');

        const passwordHash = await security.hashPassword(password);
        const user = await userRepo.createUser({
            email: normalizedEmail,
            passwordHash,
            name: name.trim(),
            role: 'member',
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
    },

    async login(email: string, password: string, ipAddress?: string, userAgent?: string) {
        const user = await userRepo.findByEmail(email.trim().toLowerCase());
        if (!user) throw new AppError('Email hoặc mật khẩu không chính xác', 400, 'INVALID_CREDENTIALS');
        if (!user.isActive) throw new AppError('Tài khoản đã bị vô hiệu hoá', 403, 'ACCOUNT_DISABLED');

        const isMatch = await security.comparePassword(password, user.passwordHash);
        if (!isMatch) throw new AppError('Email hoặc mật khẩu không chính xác', 400, 'INVALID_CREDENTIALS');

        // Generate Access Token (Short-lived, e.g. 15m or 1h)
        const accessToken = security.generateToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });

        // Generate Refresh Token (Long-lived, e.g. 7d)
        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await sessionRepo.createSession({
            userId: user.id,
            refreshToken,
            ipAddress,
            userAgent,
            expiresAt
        });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatarUrl: user.avatarUrl,
            }
        };
    },

    async refreshToken(token: string, ipAddress?: string, userAgent?: string) {
        const session = await sessionRepo.findByToken(token);
        if (!session) throw new AppError('Refresh token không hợp lệ', 401, 'INVALID_TOKEN');
        if (session.revokedAt) throw new AppError('Phiên đăng nhập đã bị thu hồi', 401, 'TOKEN_REVOKED');
        if (session.expiresAt < new Date()) throw new AppError('Phiên đăng nhập đã hết hạn', 401, 'TOKEN_EXPIRED');

        const user = await userRepo.findById(session.userId);
        if (!user || !user.isActive) throw new AppError('Tài khoản không hợp lệ', 401, 'INVALID_USER');

        // Revoke old refresh token (Rotation)
        await sessionRepo.revokeToken(token);

        // Generate new tokens
        const newAccessToken = security.generateToken({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        });

        const newRefreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await sessionRepo.createSession({
            userId: user.id,
            refreshToken: newRefreshToken,
            ipAddress,
            userAgent,
            expiresAt
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
    },

    async logout(refreshToken: string) {
        await sessionRepo.revokeToken(refreshToken);
        return true;
    },

    async changePassword(userId: string, oldPass: string, newPass: string) {
        const user = await userRepo.findById(userId);
        if (!user) throw new AppError('Tài khoản không hợp lệ', 401, 'INVALID_USER');

        const isMatch = await security.comparePassword(oldPass, user.passwordHash);
        if (!isMatch) throw new AppError('Mật khẩu cũ không chính xác', 400, 'INVALID_PASSWORD');

        const passwordHash = await security.hashPassword(newPass);
        await userRepo.updateUser(userId, { passwordHash });
        
        return true;
    },

    async forgotPassword(email: string) {
        // Check the system mail channel before looking up the account. This
        // avoids a false "email sent" result while preserving enumeration
        // safety: every address receives the same service-level failure when
        // SMTP is unavailable.
        const smtpConfig = await smtpService.getPublicConfig();
        if (!smtpConfig.configured || !smtpConfig.enabled) {
            throw new AppError(
                'Dịch vụ gửi email khôi phục đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
                503,
                'EMAIL_SERVICE_UNAVAILABLE',
            );
        }

        const user = await userRepo.findByEmail(email);
        if (!user) return true; // Do not reveal if email exists or not

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        const resetPasswordExpires = new Date();
        resetPasswordExpires.setMinutes(resetPasswordExpires.getMinutes() + 15); // 15 mins

        await userRepo.updateUser(user.id, {
            resetPasswordToken: tokenHash,
            resetPasswordExpires
        });

        const resetUrl = new URL('/auth/reset-password', `${env.FRONTEND_URL.replace(/\/+$/, '')}/`);
        resetUrl.searchParams.set('token', resetToken);
        const resetLink = resetUrl.toString();

        try {
            await smtpService.sendMail({
                to: user.email,
                subject: 'Đặt lại mật khẩu NemarkChat',
                text: [
                    'Bạn vừa yêu cầu đặt lại mật khẩu NemarkChat.',
                    '',
                    `Mở liên kết này trong vòng 15 phút: ${resetLink}`,
                    '',
                    'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.',
                ].join('\n'),
                html: [
                    '<p>Bạn vừa yêu cầu đặt lại mật khẩu NemarkChat.</p>',
                    `<p><a href="${resetLink.replace(/&/g, '&amp;')}">Đặt lại mật khẩu</a> — liên kết có hiệu lực trong 15 phút.</p>`,
                    '<p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>',
                ].join(''),
            });
        } catch (error) {
            // Keep the endpoint enumeration-safe and never log the recipient,
            // raw transport response, password, or reset token.
            const safe = smtpService.safeError(error);
            console.error('[Auth] Password reset email delivery failed', {
                code: safe.code,
                phase: safe.phase,
                retryable: safe.retryable,
            });
        }
        
        return true;
    },

    async resetPassword(token: string, newPass: string) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        
        const user = await userRepo.findByValidResetToken(tokenHash);

        if (!user) throw new AppError('Token không hợp lệ hoặc đã hết hạn', 400, 'INVALID_TOKEN');

        const passwordHash = await security.hashPassword(newPass);
        
        await userRepo.updateUser(user.id, {
            passwordHash,
            resetPasswordToken: null,
            resetPasswordExpires: null,
        });

        return true;
    },

    async setupInitialAdmin(email: string, password: string, name: string) {
        const adminCount = await userRepo.countByRole('admin');
        if (adminCount > 0) {
            throw new AppError('Thiết lập quản trị ban đầu đã hoàn tất', 403, 'SETUP_COMPLETED');
        }

        const existing = await userRepo.findByEmail(email);
        if (existing) throw new AppError('Tài khoản đã tồn tại', 400, 'ALREADY_EXISTS');
        
        const passwordHash = await security.hashPassword(password);
        const admin = await userRepo.createUser({
            email, passwordHash, name, role: 'admin',
        });
        
        return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
    },

    async updateProfile(userId: string, data: { name: string; avatarUrl?: string }) {
        const user = await userRepo.findById(userId);
        if (!user) {
            throw new AppError('Người dùng không tồn tại', 404, 'NOT_FOUND');
        }

        const updateData: any = { name: data.name };
        if (data.avatarUrl !== undefined) {
            updateData.avatarUrl = data.avatarUrl;
        }

        const updatedUser = await userRepo.updateUser(userId, updateData);
        return {
            id: updatedUser?.id,
            email: updatedUser?.email,
            name: updatedUser?.name,
            avatarUrl: updatedUser?.avatarUrl,
            role: updatedUser?.role
        };
    }
};
