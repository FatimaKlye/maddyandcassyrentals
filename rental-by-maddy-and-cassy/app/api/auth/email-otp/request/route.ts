import { NextResponse } from "next/server";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { createEmailOtp, hashEmailOtp, hasGmailOtpConfiguration, sendEmailOtp } from "@/src/lib/server/emailOtp";

export const runtime = "nodejs";

const CODE_LIFETIME_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 45_000;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "email-otp-request", 8, 15 * 60_000);
    const { user } = await requireUser();
    const email = user.email?.trim().toLowerCase();
    if (!email) throw new RequestSecurityError("Your account does not have an email address.", 400);
    if (user.email_confirmed_at) return NextResponse.json({ alreadyVerified: true });

    const gmailConfigured = hasGmailOtpConfiguration();
    if (!gmailConfigured && process.env.NODE_ENV === "production") {
      throw new RequestSecurityError("Email verification is not configured yet.", 503);
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("email_verification_challenges")
      .select("last_sent_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const lastSentAt = existing ? new Date(existing.last_sent_at).getTime() : 0;
    const retryAfterMs = RESEND_COOLDOWN_MS - (Date.now() - lastSentAt);
    if (retryAfterMs > 0) {
      return NextResponse.json(
        {
          error: `Please wait ${Math.ceil(retryAfterMs / 1000)} seconds before requesting another code.`,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        },
        { status: 429 },
      );
    }

    const code = createEmailOtp();
    const now = new Date();
    const { error: upsertError } = await admin.from("email_verification_challenges").upsert(
      {
        user_id: user.id,
        email,
        code_hash: hashEmailOtp(user.id, email, code),
        attempts: 0,
        status: "pending",
        created_at: now.toISOString(),
        last_sent_at: now.toISOString(),
        expires_at: new Date(now.getTime() + CODE_LIFETIME_MS).toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertError) throw new Error(upsertError.message);

    if (gmailConfigured) {
      try {
        await sendEmailOtp(email, code);
      } catch (deliveryError) {
        await admin.from("email_verification_challenges").delete().eq("user_id", user.id);
        throw deliveryError;
      }
      return NextResponse.json({
        delivery: "email",
        maskedEmail: email.replace(/^(.{1,2}).*(@.*)$/, (_match, start, domain) => `${start}***${domain}`),
      });
    }

    return NextResponse.json({ delivery: "preview", demoCode: code, maskedEmail: email });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Email OTP request failed", error);
    return NextResponse.json({ error: "The verification code could not be sent." }, { status: 500 });
  }
}
