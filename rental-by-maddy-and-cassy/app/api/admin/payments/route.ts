import { NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceRateLimit,
  requireAdmin,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

function serializeRecord(
  id: string,
  data: DocumentData,
): Record<string, unknown> {
  const result: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(data)) {
    result[key] =
      value && typeof value === "object" && typeof value.toDate === "function"
        ? value.toDate().toISOString()
        : value;
  }
  return result;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-payments-read", 60, 60_000);
    const db = getAdminDb();
    await requireAdmin(request, db);

    const [paymentsSnapshot, eventsSnapshot] = await Promise.all([
      db.collectionGroup("payments").get(),
      db.collection("paymentEvents").get(),
    ]);

    return NextResponse.json({
      payments: paymentsSnapshot.docs.map((item) =>
        serializeRecord(item.id, item.data()),
      ),
      events: eventsSnapshot.docs.map((item) =>
        serializeRecord(item.id, item.data()),
      ),
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin payment activity read failed", error);
    return NextResponse.json(
      { error: "Payment activity could not be loaded." },
      { status: 500 },
    );
  }
}
