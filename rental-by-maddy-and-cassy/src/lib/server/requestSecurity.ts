import { getAppCheck } from "firebase-admin/app-check";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminApp, getAdminAuth } from "@/src/lib/firebase/admin";

type RateBucket = { count: number; resetAt: number };

const globalBuckets = globalThis as typeof globalThis & {
  __maddyCassyRateBuckets?: Map<string, RateBucket>;
};

const buckets =
  globalBuckets.__maddyCassyRateBuckets ??
  (globalBuckets.__maddyCassyRateBuckets = new Map<string, RateBucket>());

export class RequestSecurityError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit = 12,
  windowMs = 60_000,
): void {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const key = `${scope}:${clientKey}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    throw new RequestSecurityError(
      "Too many requests. Please wait a moment and try again.",
      429,
    );
  }

  existing.count += 1;
}

export function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new RequestSecurityError("Authentication is required.", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new RequestSecurityError("Your session is invalid.", 401);
  }

  return token;
}

export async function requireUser(request: Request): Promise<DecodedIdToken> {
  try {
    return await getAdminAuth().verifyIdToken(getBearerToken(request));
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throw new RequestSecurityError("Your session is invalid or expired.", 401);
  }
}

export async function requireAdmin(
  request: Request,
  db: Firestore,
): Promise<DecodedIdToken> {
  const user = await requireUser(request);
  const snapshot = await db.collection("admins").doc(user.uid).get();
  if (!snapshot.exists || snapshot.data()?.active !== true) {
    throw new RequestSecurityError("Active administrator access is required.", 403);
  }
  return user;
}

export async function enforceAppCheck(request: Request): Promise<void> {
  if (process.env.ENFORCE_FIREBASE_APP_CHECK !== "true") return;

  const token = request.headers.get("x-firebase-appcheck");
  if (!token) {
    throw new RequestSecurityError("App verification is required.", 401);
  }

  try {
    await getAppCheck(getAdminApp()).verifyToken(token);
  } catch {
    throw new RequestSecurityError("App verification failed.", 401);
  }
}
