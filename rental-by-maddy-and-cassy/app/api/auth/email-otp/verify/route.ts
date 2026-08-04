import { NextResponse } from "next/server";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { verifyEmailOtpHash } from "@/src/lib/server/emailOtp";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "email-otp-verify", 20, 15 * 60_000);
    const { user } = await requireUser();
    const email = user.email?.trim().toLowerCase();
    if (!email) throw new RequestSecurityError("Your account does not have an email address.", 400);
    if (user.email_confirmed_at) return NextResponse.json({ verified: true });

    const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
    if (!/^\d{6}$/.test(code)) throw new RequestSecurityError("Enter the 6-digit verification code.", 400);

    const admin = createAdminClient();
    const { data: challenge } = await admin
      .from("email_verification_challenges")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!challenge || challenge.status !== "pending") {
      throw new RequestSecurityError("Request a new verification code and try again.", 400);
    }
    if (challenge.email.toLowerCase() !== email) {
      throw new RequestSecurityError("This verification code does not match your account.", 400);
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new RequestSecurityError("This verification code has expired. Request a new one.", 400);
    }
    if (challenge.attempts >= 5) {
      throw new RequestSecurityError("Too many incorrect attempts. Request a new code.", 429);
    }

    if (!verifyEmailOtpHash(user.id, email, code, challenge.code_hash)) {
      await admin
        .from("email_verification_challenges")
        .update({ attempts: challenge.attempts + 1 })
        .eq("user_id", user.id);
      throw new RequestSecurityError("That code is incorrect. Please check it and try again.", 400);
    }

    const { error: confirmError } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (confirmError) throw new Error(confirmError.message);

    await admin.from("email_verification_challenges").delete().eq("user_id", user.id);

    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Email OTP verification failed", error);
    return NextResponse.json({ error: "Your email could not be verified." }, { status: 500 });
  }
}
