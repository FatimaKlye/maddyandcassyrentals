import { NextResponse } from "next/server";
import { isDemoPaymentEnabled } from "@/src/lib/paymongo/demo";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { fulfillVerifiedPayment } from "@/src/lib/server/paymentFulfillment";
import { createAdminClient } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_METHODS = new Set(["gcash", "maya", "qrph", "card"]);

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Development-only fallback used when PAYMONGO_SECRET_KEY/WEBHOOK_SECRET are
 * not configured (see isDemoPaymentEnabled()) — simulates a successful
 * checkout so the full booking flow can be exercised without live PayMongo
 * credentials. Disabled outside development regardless of env state.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!isDemoPaymentEnabled()) {
      return responseError("Demo payments are disabled.", 404);
    }
    enforceRateLimit(request, "demo-payment-complete", 8, 60_000);
    const { user } = await requireUser();

    const body = (await request.json().catch(() => null)) as
      | { sessionId?: unknown; paymentMethod?: unknown }
      | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const paymentMethod = typeof body?.paymentMethod === "string" ? body.paymentMethod.trim() : "";

    if (!sessionId.startsWith("demo_") || sessionId.length > 180) {
      return responseError("Choose a valid demo checkout session.", 400);
    }
    if (!DEMO_METHODS.has(paymentMethod)) {
      return responseError("Choose a valid demo payment method.", 400);
    }

    const paymentRecordId = sessionId.slice("demo_".length);
    const admin = createAdminClient();

    const { data: payment } = await admin
      .from("payment_records")
      .select("id, user_id, booking_id")
      .eq("id", paymentRecordId)
      .maybeSingle();

    if (!payment) return responseError("The demo checkout session could not be found.", 404);
    if (payment.user_id !== user.id) {
      return responseError("You do not have access to this demo checkout.", 403);
    }

    const demoReference = `DEMO-${paymentRecordId.slice(0, 12).toUpperCase()}`;
    const result = await fulfillVerifiedPayment(admin, {
      paymentRecordId,
      providerPaymentId: demoReference,
      paymentMethod: `Demo ${paymentMethod.toUpperCase()}`,
      providerStatus: "paid",
      providerMetadata: { demo: true, checkoutSessionId: sessionId },
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      demo: true,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) return responseError(error.message, error.status);
    console.error("Demo payment completion failed", error);
    return responseError("The demo payment could not be completed. Please try again.", 500);
  }
}
