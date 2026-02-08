const nodemailer = require('nodemailer');
const env = require('../config/env');

// Create reusable transporter
const createTransporter = () => {
    if (!env.email.user || !env.email.password) {
        console.warn('[EMAIL] Warning: Email credentials not configured. Emails will be logged to console.');
        return null;
    }

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

const transporter = createTransporter();

/**
 * Send email verification link
 */
const sendEmailVerification = async (email, token) => {
    const verificationUrl = `${env.urls.frontend}/auth/verify-email?token=${token}`;

    const mailOptions = {
        from: `"${env.email.fromName}" <${env.email.fromAddress}>`,
        to: email,
        subject: 'Xác thực Email - Live Chat Support',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác thực Email</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; background-color: #F9FAFB; }
    .container { max-width: 600px; margin: 0 auto; background-color: #F9FAFB; }
    .header { padding: 40px 20px; text-align: center; }
    .logo { display: inline-flex; align-items: center; gap: 8px; color: #0b50da; }
    .logo svg { width: 40px; height: 40px; }
    .logo-text { font-size: 24px; font-weight: 800; }
    .content { background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; padding: 48px 32px; margin: 0 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .title { font-size: 24px; font-weight: 700; color: #1F2937; margin: 0 0 24px 0; text-align: center; }
    .text { font-size: 16px; color: #6B7280; line-height: 1.6; margin: 0 0 32px 0; text-align: center; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; background-color: #0b50da; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .button:hover { background-color: #0940b8; }
    .warning { background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 24px 0; font-size: 14px; color: #92400E; text-align: center; }
    .footer { padding: 48px 20px; text-align: center; color: #9CA3AF; font-size: 12px; }
    .footer-link { color: #0b50da; text-decoration: none; }
    .divider { height: 1px; background-color: #E5E7EB; width: 96px; margin: 32px auto; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"/>
        </svg>
        <span class="logo-text">Live Chat Support</span>
      </div>
    </div>
    
    <div class="content">
      <h2 class="title">Xác thực Email của bạn</h2>
      <p class="text">
        Chào bạn! Cảm ơn bạn đã đăng ký tài khoản tại <strong>Live Chat Support</strong>.
        Vui lòng nhấn nút bên dưới để xác thực địa chỉ email của bạn.
      </p>
      
      <div class="button-container">
        <a href="${verificationUrl}" class="button">Xác thực Email</a>
      </div>
      
      <div class="warning">
        ⏱️ Link này sẽ hết hạn trong <strong>30 phút</strong>. 
        Vui lòng không chia sẻ link này với bất kỳ ai.
      </div>
      
      <p class="text" style="font-size: 14px; color: #9CA3AF; margin-top: 24px;">
        Hoặc copy và paste link sau vào trình duyệt:<br>
        <span style="color: #6B7280; word-break: break-all;">${verificationUrl}</span>
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 24px 0; line-height: 1.6;">
        Bạn không yêu cầu email này? Hãy bỏ qua hoặc 
        <a href="#" class="footer-link">liên hệ hỗ trợ</a> nếu cần.
      </p>
      <div class="divider"></div>
      <p style="margin: 0 0 8px 0; font-weight: 500;">© 2024 Live Chat Support</p>
      <p style="margin: 0 0 24px 0; padding: 0 40px; line-height: 1.6;">
        Tòa nhà Innovation Lab, Khu Công Nghệ Cao, Quận 9, TP. Hồ Chí Minh
      </p>
      <div style="font-weight: 600;">
        <a href="#" class="footer-link">Chính sách bảo mật</a>
        <span style="color: #D1D5DB; margin: 0 8px;">•</span>
        <a href="#" class="footer-link">Điều khoản sử dụng</a>
      </div>
    </div>
  </div>
</body>
</html>
    `,
        text: `
      Xác thực Email
      
      Chào bạn! Cảm ơn bạn đã đăng ký tài khoản tại Live Chat Support.
      
      Vui lòng xác thực email của bạn bằng cách truy cập link sau:
      ${verificationUrl}
      
      Link này sẽ hết hạn trong 30 phút.
      
      Nếu bạn không yêu cầu email này, vui lòng bỏ qua.
      
      © 2024 Live Chat Support
    `,
    };

    return sendEmail(mailOptions);
};

/**
 * Send password reset link
 */
const sendPasswordReset = async (email, token) => {
    const resetUrl = `${env.urls.frontend}/auth/reset-password?token=${token}`;

    const mailOptions = {
        from: `"${env.email.fromName}" <${env.email.fromAddress}>`,
        to: email,
        subject: 'Đặt lại Mật khẩu - Live Chat Support',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại Mật khẩu</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif; background-color: #F9FAFB; }
    .container { max-width: 600px; margin: 0 auto; background-color: #F9FAFB; }
    .header { padding: 40px 20px; text-align: center; }
    .logo { display: inline-flex; align-items: center; gap: 8px; color: #dc2626; }
    .logo svg { width: 40px; height: 40px; }
    .logo-text { font-size: 24px; font-weight: 800; }
    .content { background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E5E7EB; padding: 48px 32px; margin: 0 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .title { font-size: 24px; font-weight: 700; color: #1F2937; margin: 0 0 24px 0; text-align: center; }
    .text { font-size: 16px; color: #6B7280; line-height: 1.6; margin: 0 0 32px 0; text-align: center; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; background-color: #dc2626; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; }
    .button:hover { background-color: #b91c1c; }
    .warning { background-color: #FEE2E2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 24px 0; font-size: 14px; color: #991B1B; text-align: center; }
    .footer { padding: 48px 20px; text-align: center; color: #9CA3AF; font-size: 12px; }
    .footer-link { color: #dc2626; text-decoration: none; }
    .divider { height: 1px; background-color: #E5E7EB; width: 96px; margin: 32px auto; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"/>
        </svg>
        <span class="logo-text">Live Chat Support</span>
      </div>
    </div>
    
    <div class="content">
      <h2 class="title">Đặt lại Mật khẩu</h2>
      <p class="text">
        Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình tại <strong>Live Chat Support</strong>.
        Nhấn nút bên dưới để tiếp tục.
      </p>
      
      <div class="button-container">
        <a href="${resetUrl}" class="button">Đặt lại Mật khẩu</a>
      </div>
      
      <div class="warning">
        ⏱️ Link này sẽ hết hạn trong <strong>15 phút</strong>. 
        Vui lòng không chia sẻ link này với bất kỳ ai.
      </div>
      
      <p class="text" style="font-size: 14px; color: #9CA3AF; margin-top: 24px;">
        Hoặc copy và paste link sau vào trình duyệt:<br>
        <span style="color: #6B7280; word-break: break-all;">${resetUrl}</span>
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0 0 24px 0; line-height: 1.6;">
        Bạn không yêu cầu đặt lại mật khẩu? Hãy bỏ qua email này hoặc 
        <a href="#" class="footer-link">liên hệ hỗ trợ</a> nếu cần.
      </p>
      <div class="divider"></div>
      <p style="margin: 0 0 8px 0; font-weight: 500;">© 2024 Live Chat Support</p>
      <p style="margin: 0 0 24px 0; padding: 0 40px; line-height: 1.6;">
        Tòa nhà Innovation Lab, Khu Công Nghệ Cao, Quận 9, TP. Hồ Chí Minh
      </p>
      <div style="font-weight: 600;">
        <a href="#" class="footer-link">Chính sách bảo mật</a>
        <span style="color: #D1D5DB; margin: 0 8px;">•</span>
        <a href="#" class="footer-link">Điều khoản sử dụng</a>
      </div>
    </div>
  </div>
</body>
</html>
    `,
        text: `
      Đặt lại Mật khẩu
      
      Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản tại Live Chat Support.
      
      Vui lòng truy cập link sau để đặt mật khẩu mới:
      ${resetUrl}
      
      Link này sẽ hết hạn trong 15 phút.
      
      Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
      
      © 2024 Live Chat Support
    `,
    };

    return sendEmail(mailOptions);
};

/**
 * Generic email sender with fallback to console
 */
const sendEmail = async (mailOptions) => {
    if (!transporter) {
        // Fallback: log to console if email not configured
        console.log('\n========== EMAIL (Not Sent - No Config) ==========');
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('Text:', mailOptions.text);
        console.log('==================================================\n');
        return { success: true, mocked: true };
    }

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[EMAIL] Failed to send:', error.message);
        // Fallback to console log on error
        console.log('\n========== EMAIL (Failed to Send) ==========');
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('Text:', mailOptions.text);
        console.log('Error:', error.message);
        console.log('============================================\n');
        throw error;
    }
};

module.exports = {
    sendEmailVerification,
    sendPasswordReset,
    sendEmail,
};
