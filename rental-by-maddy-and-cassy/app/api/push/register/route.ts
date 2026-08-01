import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "push-register", 10, 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (token.length < 20 || token.length > 4096) {
      return NextResponse.json({ error: "The push registration token is invalid." }, { status: 400 });
    }
    const tokenId = createHash("sha256").update(token).digest("hex");
    await getAdminDb()
      .collection("users")
      .doc(user.uid)
      .collection("pushTokens")
      .doc(tokenId)
      .set(
        {
          token,
          platform: "web",
          userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? "",
          updatedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        },
        { merge: true },
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Push notifications could not be enabled." }, { status: 500 });
  }
}
