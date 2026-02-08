const nodemailer = require('nodemailer');
const env = require('../config/env');

/**
 * Create email transporter
 */
const createTransporter = () => {
    return nodemailer.createTransport({
        host: env.email.host,
        port: env.email.port,
        secure: env.email.secure,
        auth: {
            user: env.email.user,
            pass: env.email.password,
        },
    });
};

/**
 * Send workspace invite email
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.workspaceName - Workspace name
 * @param {string} params.role - Role assigned
 * @param {string} params.inviterName - Name of person who invited
 * @param {string} params.token - Invite token
 * @param {Date} params.expiresAt - Expiry date
 */
const sendWorkspaceInvite = async ({ to, workspaceName, role, inviterName, token, expiresAt }) => {
    const transporter = createTransporter();

    const acceptUrl = `${env.urls.frontend}/invites/accept?token=${token}`;
    const expiryDate = new Date(expiresAt).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const mailOptions = {
        from: `"${env.email.fromName}" <${env.email.fromAddress}>`,
        to,
        subject: `Bạn được mời tham gia workspace "${workspaceName}"`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Lời mời workspace</h1>
        </div>
        <div class="content">
            <p>Xin chào,</p>
            
            <p><strong>${inviterName}</strong> đã mời bạn tham gia workspace <strong>"${workspaceName}"</strong> với vai trò <strong>${role}</strong>.</p>
            
            <div class="info-box">
                <p><strong>📋 Thông tin:</strong></p>
                <ul>
                    <li>Workspace: ${workspaceName}</li>
                    <li>Vai trò: ${role}</li>
                    <li>Người mời: ${inviterName}</li>
                    <li>Hết hạn: ${expiryDate}</li>
                </ul>
            </div>
            
            <p>Nhấn vào nút bên dưới để chấp nhận lời mời:</p>
            
            <div style="text-align: center;">
                <a href="${acceptUrl}" class="button">Chấp nhận lời mời</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                Hoặc copy link sau vào trình duyệt:<br>
                <a href="${acceptUrl}">${acceptUrl}</a>
            </p>
            
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
                ⚠️ Lời mời này sẽ hết hạn vào ${expiryDate}.<br>
                Nếu bạn không yêu cầu email này, vui lòng bỏ qua.
            </p>
        </div>
        <div class="footer">
            <p>© 2026 Live Chat Support. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `,
        text: `
Xin chào,

${inviterName} đã mời bạn tham gia workspace "${workspaceName}" với vai trò ${role}.

Thông tin:
- Workspace: ${workspaceName}
- Vai trò: ${role}
- Người mời: ${inviterName}
- Hết hạn: ${expiryDate}

Nhấn vào link sau để chấp nhận lời mời:
${acceptUrl}

Lời mời này sẽ hết hạn vào ${expiryDate}.
Nếu bạn không yêu cầu email này, vui lòng bỏ qua.

---
Live Chat Support
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Invite sent to ${to} | MessageId: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('[EMAIL] Failed to send invite:', error);
        throw error;
    }
};

/**
 * Send welcome email to new user who registered from invite
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.displayName - User's display name
 * @param {string} params.workspaceName - Workspace name
 * @param {string} params.role - Role assigned
 */
const sendWelcomeEmail = async ({ to, displayName, workspaceName, role }) => {
    const transporter = createTransporter();

    const loginUrl = `${env.urls.frontend}/auth/login`;

    const mailOptions = {
        from: `"${env.email.fromName}" <${env.email.fromAddress}>`,
        to,
        subject: `Chào mừng bạn đến với ${workspaceName}!`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white !important; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .info-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Chào mừng bạn!</h1>
        </div>
        <div class="content">
            <p>Xin chào <strong>${displayName}</strong>,</p>
            
            <p>Tài khoản của bạn đã được tạo thành công và bạn đã tham gia workspace <strong>"${workspaceName}"</strong> với vai trò <strong>${role}</strong>!</p>
            
            <div class="info-box">
                <p><strong>📋 Thông tin đăng nhập:</strong></p>
                <ul>
                    <li>Email: ${to}</li>
                    <li>Workspace: ${workspaceName}</li>
                    <li>Vai trò: ${role}</li>
                </ul>
            </div>
            
            <p>Bạn có thể đăng nhập ngay để bắt đầu sử dụng:</p>
            
            <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Đăng nhập ngay</a>
            </div>
            
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
                💡 <strong>Tip:</strong> Bạn có thể thay đổi mật khẩu trong phần Settings sau khi đăng nhập.
            </p>
        </div>
        <div class="footer">
            <p>© 2026 Live Chat Support. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        `,
        text: `
Xin chào ${displayName},

Tài khoản của bạn đã được tạo thành công và bạn đã tham gia workspace "${workspaceName}" với vai trò ${role}!

Thông tin đăng nhập:
- Email: ${to}
- Workspace: ${workspaceName}
- Vai trò: ${role}

Đăng nhập ngay: ${loginUrl}

Tip: Bạn có thể thay đổi mật khẩu trong phần Settings sau khi đăng nhập.

---
Live Chat Support
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Welcome email sent to ${to} | MessageId: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error('[EMAIL] Failed to send welcome email:', error);
        // Don't throw - welcome email is not critical
        return null;
    }
};

module.exports = {
    sendWorkspaceInvite,
    sendWelcomeEmail,
};
