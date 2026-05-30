"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import nodemailer from "nodemailer";
import { api } from "./_generated/api";

export const sendOtpEmail = internalAction({
  args: {
    email: v.string(),
    otpCode: v.string(),
  },
  handler: async (ctx, args) => {
    // Query settings from DB using ctx.runQuery
    const settings: Record<string, any> = await ctx.runQuery(api.settings.getMultiple, {
      keys: [
        "mail_host",
        "mail_port",
        "mail_username",
        "mail_password",
        "mail_encryption",
        "mail_from_email",
        "mail_from_name",
      ],
    });

    const host = (settings.mail_host ?? "").trim();
    const portValue = Number(settings.mail_port ?? 0);
    const username = (settings.mail_username ?? "").trim();
    const password = (settings.mail_password ?? "").trim();
    const encryption = (settings.mail_encryption ?? "").trim();
    const fromEmail = (settings.mail_from_email ?? "").trim();
    const fromName = (settings.mail_from_name ?? "").trim();

    if (!host || !portValue || !username || !password || !fromEmail) {
      console.warn("SMTP is not configured. Falling back to console logging OTP code.");
      console.log(`[DEV MODE OTP] Email: ${args.email}, Code: ${args.otpCode}`);
      return { success: false, reason: "Thiếu cấu hình SMTP" };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port: portValue,
        secure: encryption === "ssl",
        auth: {
          user: username,
          pass: password,
        },
      });

      await transporter.sendMail({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: args.email,
        subject: "[Thanshoes] Mã xác minh tạo mật khẩu",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #2b6cb0; text-align: center;">Xác Minh Tài Khoản</h2>
            <p>Xin chào,</p>
            <p>Bạn đã yêu cầu tạo mật khẩu cho tài khoản liên kết với email này trên cửa hàng của chúng tôi.</p>
            <p>Mã xác minh (OTP) của bạn là:</p>
            <div style="background-color: #f7fafc; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #2d3748; border: 1px dashed #cbd5e0; margin: 20px 0;">
              ${args.otpCode}
            </div>
            <p>Mã này có hiệu lực trong vòng 10 phút. Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #718096; text-align: center;">Đây là email tự động, vui lòng không phản hồi.</p>
          </div>
        `,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      return { success: false, reason: "Lỗi kết nối hoặc gửi email" };
    }
  },
  returns: v.object({
    success: v.boolean(),
    reason: v.optional(v.string()),
  }),
});
