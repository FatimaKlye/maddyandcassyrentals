import { NextResponse } from "next/server";
import { findPaymentBySubmissionId, PayMongoError } from "@/src/lib/paymongo/client";
import { fulfillVerifiedPayment } from "@/src/lib/server/paymentFulfillment";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getBookingById } from "@/src/services/bookingService";
import { isUuid } from "@/src/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, status: "error", error: message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "payment-reconcile", 20, 60_000);
    const { user } = await requireUser();
    const body = (await request.json().catch(() => null)) as { bookingId?: unknown } | null;
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    if (!isUuid(bookingId)) return responseError("Choose a valid booking to check.", 400);

    const admin = createAdminClient();
    const booking = await getBookingById(admin, bookingId);
    if (!booking) return responseError("This reservation could not be found.", 404);
    if (booking.customerId !== user.id) {
      return responseError("You do not have access to this reservation.", 403);
    }

    const { data: payments, error: paymentError } = await admin
      .from("booking_payment_submissions")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });
    if (paymentError) throw paymentError;

    const pending = (payments ?? []).find((payment) => payment.status === "submitted");
    if (!pending) {
      const hasVerifiedPayment = (payments ?? []).some((payment) => payment.status === "verified");
      return NextResponse.json({ success: true, status: hasVerifiedPayment ? "verified" : "unpaid" });
    }

    const providerPayment = await findPaymentBySubmissionId(pending.id);
    if (!providerPayment) {
      return NextResponse.json({ success: true, status: "pending" });
    }

    const sessionMeta = (pending.provider_metadata as Record<string, unknown>) ?? {};
    const metadata = providerPayment.metadata;
    const expectedAmount = Math.round(pending.declared_amount * 100);
    const identityMatches =
      metadata.payment_submission_id === pending.id &&
      metadata.booking_id === bookingId &&
      metadata.user_id === user.id;
    const modeMatches =
      typeof sessionMeta.livemode !== "boolean" ||
      sessionMeta.livemode === providerPayment.livemode;
    const amountMatches = providerPayment.amountCentavos === expectedAmount;
    const currencyMatches = providerPayment.currency.toUpperCase() === "PHP";

    if (!identityMatches || !modeMatches || !amountMatches || !currencyMatches) {
      return responseError("PayMongo returned payment details that do not match this reservation.", 409);
    }

    if (providerPayment.status === "paid") {
      await fulfillVerifiedPayment(admin, {
        paymentSubmissionId: pending.id,
        providerPaymentId: providerPayment.id,
        paymentMethod: providerPayment.paymentMethod,
        providerStatus: providerPayment.status,
        providerMetadata: {
          reconciledOnReturn: true,
          livemode: providerPayment.livemode,
        },
      });
      return NextResponse.json({ success: true, status: "verified" });
    }

    if (["failed", "expired", "cancelled"].includes(providerPayment.status)) {
      await admin
        .from("booking_payment_submissions")
        .update({
          status: "rejected",
          review_notes: `PayMongo reported ${providerPayment.status}.`,
          reviewed_at: new Date().toISOString(),
          provider_metadata: {
            ...sessionMeta,
            providerPaymentId: providerPayment.id,
            providerStatus: providerPayment.status,
          },
        })
        .eq("id", pending.id)
        .eq("status", "submitted");
      return NextResponse.json({ success: true, status: "failed" });
    }

    return NextResponse.json({ success: true, status: "pending" });
  } catch (error) {
    if (error instanceof RequestSecurityError) return responseError(error.message, error.status);
    if (error instanceof PayMongoError) return responseError(error.message, error.status);
    console.error("PayMongo reconciliation failed", error);
    return responseError("The payment status could not be confirmed. Please try again.", 500);
  }
}
