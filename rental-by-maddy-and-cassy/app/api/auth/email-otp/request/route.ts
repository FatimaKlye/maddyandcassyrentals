import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import {
  createEmailOtp,
  hashEmailOtp,
  hasGmailOtpConfiguration,
  sendEmailOtp,
} from "@/src/lib/server/emailOtp";

export const runtime = "nodejs";

const CODE_LIFETIME_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 45_000;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "email-otp-request", 8, 15 * 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      throw new RequestSecurityError(
        "Your account does not have an email address.",
        400,
      );
    }
    if (user.email_verified) {
      return NextResponse.json({ alreadyVerified: true });
    }

    const gmailConfigured = hasGmailOtpConfiguration();
    if (!gmailConfigured && process.env.NODE_ENV === "production") {
      throw new RequestSecurityError(
        "Email verification is not configured yet.",
        503,
      );
    }

    const db = getAdminDb();
    const challengeRef = db.collection("emailVerificationChallenges").doc(user.uid);
    const existing = await challengeRef.get();
    const lastSentAt = existing.data()?.lastSentAt?.toMillis?.() ?? 0;
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
    const now = Date.now();
    await challengeRef.set({
      uid: user.uid,
      email,
      codeHash: hashEmailOtp(user.uid, email, code),
      attempts: 0,
      status: "pending",
      createdAt: Timestamp.fromMillis(now),
      lastSentAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + CODE_LIFETIME_MS),
    });

    if (gmailConfigured) {
      try {
        await sendEmailOtp(email, code);
      } catch (deliveryError) {
        await challengeRef.delete().catch(() => undefined);
        throw deliveryError;
      }
      return NextResponse.json({
        delivery: "email",
        maskedEmail: email.replace(
          /^(.{1,2}).*(@.*)$/,
          (_match, start, domain) => `${start}***${domain}`,
        ),
      });
    }

    return NextResponse.json({
      delivery: "preview",
      demoCode: code,
      maskedEmail: email,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Email OTP request failed", error);
    return NextResponse.json(
      { error: "The verification code could not be sent." },
      { status: 500 },
    );
  }
}
