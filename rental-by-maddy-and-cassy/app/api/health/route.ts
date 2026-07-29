import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebase/admin";
import { isDemoPaymentEnabled } from "@/src/lib/paymongo/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    firebase: false,
    paymongoConfigured: Boolean(process.env.PAYMONGO_SECRET_KEY),
    webhookConfigured: Boolean(process.env.PAYMONGO_WEBHOOK_SECRET),
    demoPaymentEnabled: isDemoPaymentEnabled(),
    appCheckEnforced: process.env.ENFORCE_FIREBASE_APP_CHECK === "true",
  };
  try {
    await getAdminDb().collection("websiteContent").limit(1).get();
    checks.firebase = true;
  } catch {
    // Return a safe degraded response without exposing provider details.
  }
  const healthy =
    checks.firebase &&
    (checks.demoPaymentEnabled ||
      (checks.paymongoConfigured && checks.webhookConfigured));
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
