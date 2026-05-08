import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendPasswordResetEmail = async (to: string, newPassword: string) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('EMAIL_USER and EMAIL_PASS are not set. Cannot send email.');
    throw new Error('Cấu hình email chưa được thiết lập trên server.');
  }

  const mailOptions = {
    from: `"AutoPost FB AI Pro" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Khôi phục mật khẩu - AutoPost FB AI Pro',
    text: `Mật khẩu mới của bạn là: ${newPassword}\nVui lòng đăng nhập và đổi mật khẩu sớm nhất có thể.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #6366f1; text-align: center;">Khôi phục mật khẩu</h2>
        <p>Xin chào,</p>
        <p>Mật khẩu mới của bạn cho tài khoản <strong>AutoPost FB AI Pro</strong> là:</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 24px; font-weight: bold; padding: 12px 24px; background-color: #f3f4f6; display: inline-block; border-radius: 6px; letter-spacing: 2px;">${newPassword}</p>
        </div>
        <p>Vui lòng đăng nhập và bảo mật tài khoản của bạn sớm nhất có thể.</p>
        <br/>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">Trân trọng,<br/>Đội ngũ AutoPost FB AI Pro</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
