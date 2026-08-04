import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { RequestSecurityError } from "@/src/lib/server/requestSecurityError";

const OTP_LENGTH = 6;

function otpSecret(): string {
  const configured = process.env.EMAIL_OTP_HMAC_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "development-only:maddy-cassy";
  }
  throw new RequestSecurityError(
    "Email verification is not configured yet.",
    503,
  );
}

export function createEmailOtp(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function hashEmailOtp(uid: string, email: string, code: string): string {
  return createHmac("sha256", otpSecret())
    .update(`${uid}:${email.toLowerCase()}:${code}`)
    .digest("hex");
}

export function verifyEmailOtpHash(
  uid: string,
  email: string,
  code: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashEmailOtp(uid, email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hasGmailOtpConfiguration(): boolean {
  return Boolean(
    process.env.GMAIL_SMTP_USER?.trim() &&
      process.env.GMAIL_SMTP_APP_PASSWORD?.trim(),
  );
}

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const user = process.env.GMAIL_SMTP_USER?.trim();
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) {
    throw new RequestSecurityError(
      "Gmail verification delivery is not configured yet.",
      503,
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Rental by Maddy & Cassy" <${user}>`,
    to: email,
    subject: `${code} is your Rental by Maddy & Cassy verification code`,
    text:
      `Your verification code is ${code}. ` +
      "It expires in 10 minutes. If you did not create this account, you can ignore this email.",
    html: `
      <div style="margin:0;background:#f7f7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#242424">
        <div style="max-width:520px;margin:0 auto;border:1px solid #eadfdd;border-radius:20px;background:#fff;padding:32px">
          <p style="margin:0 0 8px;color:#9a5965;font-size:12px;font-weight:700;letter-spacing:1px">EMAIL VERIFICATION</p>
          <h1 style="margin:0 0 12px;font-size:24px">Welcome to Rental by Maddy &amp; Cassy</h1>
          <p style="margin:0 0 22px;color:#555;line-height:1.6">Enter this one-time code to verify your email and finish creating your account.</p>
          <div style="border-radius:14px;background:#f2d2cf;padding:18px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#83454f">${code}</div>
          <p style="margin:20px 0 0;color:#777;font-size:13px;line-height:1.5">This code expires in 10 minutes. If you did not create this account, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  });
}
