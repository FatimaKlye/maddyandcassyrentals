import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceRateLimit,
  requireAdmin,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    enforceRateLimit(request, "admin-access-check", 60, 60_000);
    const db = getAdminDb();
    const admin = await requireAdmin(request, db);
    return NextResponse.json({ isAdmin: true, uid: admin.uid });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Administrator access could not be verified." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "admin-session", 10, 60_000);
    const db = getAdminDb();
    const admin = await requireAdmin(request, db);
    await db.collection("auditLogs").add({
      action: "admin.login",
      actorType: "admin",
      actorId: admin.uid,
      targetType: "admin_session",
      targetId: admin.uid,
      metadata: {
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown",
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? "",
      },
      createdAt: Timestamp.now(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "The administrator session could not be recorded." }, { status: 500 });
  }
}
