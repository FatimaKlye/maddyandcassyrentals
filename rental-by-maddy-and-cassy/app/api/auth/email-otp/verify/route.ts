import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import { verifyEmailOtpHash } from "@/src/lib/server/emailOtp";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "email-otp-verify", 20, 15 * 60_000);
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
      return NextResponse.json({ verified: true });
    }

    const body = (await request.json().catch(() => null)) as
      | { code?: unknown }
      | null;
    const code =
      typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";
    if (!/^\d{6}$/.test(code)) {
      throw new RequestSecurityError("Enter the 6-digit verification code.", 400);
    }

    const db = getAdminDb();
    const challengeRef = db.collection("emailVerificationChallenges").doc(user.uid);
    const challenge = await challengeRef.get();
    const data = challenge.data();
    if (!challenge.exists || !data || data.status !== "pending") {
      throw new RequestSecurityError(
        "Request a new verification code and try again.",
        400,
      );
    }
    if (String(data.email || "").toLowerCase() !== email) {
      throw new RequestSecurityError(
        "This verification code does not match your account.",
        400,
      );
    }
    if ((data.expiresAt?.toMillis?.() ?? 0) < Date.now()) {
      throw new RequestSecurityError(
        "This verification code has expired. Request a new one.",
        400,
      );
    }
    if (Number(data.attempts || 0) >= 5) {
      throw new RequestSecurityError(
        "Too many incorrect attempts. Request a new code.",
        429,
      );
    }

    if (
      !verifyEmailOtpHash(
        user.uid,
        email,
        code,
        String(data.codeHash || ""),
      )
    ) {
      await challengeRef.update({
        attempts: Number(data.attempts || 0) + 1,
        updatedAt: Timestamp.now(),
      });
      throw new RequestSecurityError(
        "That code is incorrect. Please check it and try again.",
        400,
      );
    }

    await getAdminAuth().updateUser(user.uid, { emailVerified: true });
    const batch = db.batch();
    batch.set(
      db.collection("users").doc(user.uid),
      {
        emailVerified: true,
        emailVerifiedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
    batch.delete(challengeRef);
    await batch.commit();

    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Email OTP verification failed", error);
    return NextResponse.json(
      { error: "Your email could not be verified." },
      { status: 500 },
    );
  }
}
