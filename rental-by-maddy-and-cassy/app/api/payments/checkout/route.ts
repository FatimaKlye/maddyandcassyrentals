import { NextResponse } from "next/server";
import { createCheckoutSession, PayMongoError } from "@/src/lib/paymongo/client";
import { isDemoPaymentEnabled } from "@/src/lib/paymongo/demo";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { getBookingById } from "@/src/services/bookingService";
import { isUuid } from "@/src/lib/uuid";
import type { Database } from "@/src/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentStage = Database["public"]["Enums"]["payment_stage"];

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isPaymentOption(value: unknown): value is "deposit_50" | "full" | "balance" {
  return value === "deposit_50" || value === "full" || value === "balance";
}

/** payment_stage has no direct "deposit_50"/"full" concept — down_payment covers the
 * 50% reservation option, balance covers paying off a remaining balance, and a
 * single full payment (no prior deposit) doesn't fit either bucket cleanly, so it's
 * recorded as "other". */
function paymentOptionToStage(option: "deposit_50" | "full" | "balance"): PaymentStage {
  if (option === "deposit_50") return "down_payment";
  if (option === "balance") return "balance";
  return "other";
}

function safeReturnPath(value: unknown, fallback: string): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\r") &&
    !value.includes("\n")
  ) {
    return value;
  }
  return fallback;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "payment-checkout", 8, 60_000);
    const { user } = await requireUser();
    const admin = createAdminClient();

    const body = (await request.json().catch(() => null)) as
      | { bookingId?: unknown; paymentOption?: unknown; returnPath?: unknown }
      | null;
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId || !isUuid(bookingId)) {
      return responseError("Choose a valid booking to pay.", 400);
    }

    const booking = await getBookingById(admin, bookingId);
    if (!booking) return responseError("The selected booking could not be found.", 404);
    if (booking.customerId !== user.id) {
      return responseError("You do not have access to this booking.", 403);
    }
    if (!["pending", "approved", "confirmed"].includes(booking.status)) {
      return responseError("Payment is not available for this booking.", 409);
    }

    const paymentOption = isPaymentOption(body?.paymentOption) ? body.paymentOption : "full";
    const stage = paymentOptionToStage(paymentOption);

    const { data: priorPayments } = await admin
      .from("booking_payment_submissions")
      .select("declared_amount, status")
      .eq("booking_id", bookingId)
      .eq("status", "verified");
    const amountPaid = (priorPayments ?? []).reduce((sum, row) => sum + row.declared_amount, 0);

    const balanceDue = Math.max(0, booking.totalAmount - amountPaid);
    if (balanceDue <= 0) return responseError("This booking is already paid.", 409);

    const amount =
      paymentOption === "deposit_50" && amountPaid === 0
        ? Math.round(booking.totalAmount * 50) / 100
        : balanceDue;
    const amountCentavos = Math.round(amount * 100);
    if (amountCentavos < 100) {
      return responseError("The booking amount is below the payment minimum.", 409);
    }

    const demoMode = isDemoPaymentEnabled();

    const { data: reusable } = await admin
      .from("booking_payment_submissions")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("status", "submitted")
      .eq("stage", stage)
      .eq("declared_amount", amount)
      .not("paymongo_checkout_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reusable?.external_reference && reusable.provider_metadata) {
      const meta = reusable.provider_metadata as Record<string, unknown>;
      if (typeof meta.checkoutUrl === "string") {
        return NextResponse.json({
          success: true,
          checkoutUrl: meta.checkoutUrl,
          paymentId: reusable.id,
          reused: true,
        });
      }
    }

    const paymentSubmissionId = crypto.randomUUID();
    const referenceNumber = `${booking.bookingRef}-${paymentSubmissionId.slice(0, 8)}`;
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const returnPath = safeReturnPath(body?.returnPath, `/account/bookings/${bookingId}`);
    const returnUrl = `${appOrigin}${returnPath}`;
    const returnSeparator = returnUrl.includes("?") ? "&" : "?";
    const paymentLabel =
      paymentOption === "deposit_50"
        ? "50% reservation payment"
        : paymentOption === "balance"
          ? "Remaining rental balance"
          : "Full rental payment";

    const checkout = demoMode
      ? {
          id: `demo_${paymentSubmissionId}`,
          checkoutUrl:
            `${appOrigin}/demo/paymongo?` +
            new URLSearchParams({
              amount: amount.toFixed(2),
              item: booking.productSnapshot.name || "Rental item",
              bookingRef: booking.bookingRef,
              paymentLabel,
              returnPath,
              sessionId: `demo_${paymentSubmissionId}`,
              paymentRecordId: paymentSubmissionId,
            }).toString(),
          livemode: false,
        }
      : await createCheckoutSession({
          amountCentavos,
          productName: booking.productSnapshot.name || "Rental item",
          bookingRef: booking.bookingRef,
          referenceNumber,
          customer: {
            name: booking.customerSnapshot.fullName || "Customer",
            email: booking.customerSnapshot.email || user.email || "",
            phone: booking.customerSnapshot.phone || "",
          },
          paymentLabel,
          successUrl: `${returnUrl}${returnSeparator}payment=success`,
          cancelUrl: `${returnUrl}${returnSeparator}payment=cancelled`,
          metadata: {
            booking_id: bookingId,
            payment_submission_id: paymentSubmissionId,
            user_id: user.id,
          },
          idempotencyKey: `checkout-${bookingId}-${paymentSubmissionId}`,
        });

    await admin.from("booking_payment_submissions").insert({
      id: paymentSubmissionId,
      booking_id: bookingId,
      stage,
      declared_amount: amount,
      status: "submitted",
      external_reference: referenceNumber,
      idempotency_key: `checkout-${bookingId}-${paymentSubmissionId}`,
      paymongo_checkout_session_id: checkout.id,
      provider_metadata: { checkoutUrl: checkout.checkoutUrl, livemode: checkout.livemode, demo: demoMode },
    });

    await admin.from("notifications").insert({
      user_id: user.id,
      booking_id: bookingId,
      notification_type: "payment_pending",
      title: demoMode ? "Demo payment checkout ready" : "Payment checkout ready",
      message: demoMode
        ? `Your demo checkout for ${booking.bookingRef} is ready. No real money will be processed.`
        : `Your secure payment checkout for ${booking.bookingRef} is ready.`,
      action_url: `/account/bookings/${bookingId}`,
    });

    await admin.rpc("log_audit_event", {
      p_action: "payment.checkout_created",
      p_entity_type: "payment_submission",
      p_entity_id: paymentSubmissionId,
      p_booking_id: bookingId,
      p_new_values: { checkoutSessionId: checkout.id, amount, paymentOption, demo: demoMode },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentId: paymentSubmissionId,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) return responseError(error.message, error.status);
    if (error instanceof PayMongoError) return responseError(error.message, error.status);
    console.error("Payment checkout creation failed", error);
    return responseError("The secure checkout could not be created. Please try again.", 500);
  }
}
