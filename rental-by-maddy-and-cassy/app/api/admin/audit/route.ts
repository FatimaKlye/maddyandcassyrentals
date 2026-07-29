import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceRateLimit,
  requireAdmin,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-audit-read", 60, 60_000);
    const db = getAdminDb();
    await requireAdmin(request, db);

    const snapshot = await db
      .collection("auditLogs")
      .orderBy("createdAt", "desc")
      .limit(300)
      .get();

    const logs = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        action: String(data.action || "system.activity"),
        actorType: String(data.actorType || "system"),
        actorId: String(data.actorId || "system"),
        bookingId:
          typeof data.bookingId === "string" ? data.bookingId : undefined,
        targetType: String(data.targetType || "record"),
        targetId: String(data.targetId || item.id),
        metadata:
          data.metadata && typeof data.metadata === "object"
            ? data.metadata
            : undefined,
        createdAt:
          data.createdAt && typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate().toISOString()
            : null,
      };
    });

    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin audit read failed", error);
    return NextResponse.json(
      { error: "Audit history could not be loaded." },
      { status: 500 },
    );
  }
}
