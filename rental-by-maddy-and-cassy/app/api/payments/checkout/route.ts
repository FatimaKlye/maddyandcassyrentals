import { NextResponse } from "next/server";
import { createCheckoutSession, PayMongoError } from "@/src/lib/paymongo/client";
import { isDemoPaymentEnabled } from "@/src/lib/paymongo/demo";
import { enforceRateLimit, requireUser, RequestSecurityError } from "@/src/lib/server/requestSecurity";
import { generateAndSaveInvoice } from "@/src/lib/server/customerDocuments";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { mapBooking } from "@/src/services/bookingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function documentNumber(prefix: string, bookingRef: string, id: string): string {
  const cleanBooking = bookingRef.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  return `${prefix}-${cleanBooking}-${id.slice(0, 6).toUpperCase()}`;
}

function isPaymentOption(value: unknown): value is "deposit_50" | "full" | "balance" {
  return value === "deposit_50" || value === "full" || value === "balance";
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
    if (!bookingId || bookingId.length > 100) {
      return responseError("Choose a valid booking to pay.", 400);
    }

    const { data: bookingRow } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!bookingRow) return responseError("The selected booking could not be found.", 404);
    if (bookingRow.user_id !== user.id) {
      return responseError("You do not have access to this booking.", 403);
    }
    if (!["pending", "approved", "confirmed"].includes(bookingRow.status)) {
      return responseError("Payment is not available for this booking.", 409);
    }
    const booking = mapBooking(bookingRow);

    const paymentOption = isPaymentOption(body?.paymentOption) ? body.paymentOption : "full";

    const { data: priorPayments } = await admin
      .from("payment_records")
      .select("amount, status")
      .eq("booking_id", bookingId)
      .in("status", ["verified", "paid"]);
    const amountPaid = (priorPayments ?? []).reduce((sum, row) => sum + row.amount, 0);

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
      .from("payment_records")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("status", "pending")
      .eq("payment_kind", paymentOption)
      .eq("amount", amount)
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

    const paymentRecordId = crypto.randomUUID();
    const referenceNumber = `${booking.bookingRef}-${paymentRecordId.slice(0, 8)}`;
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
          id: `demo_${paymentRecordId}`,
          checkoutUrl:
            `${appOrigin}/demo/paymongo?` +
            new URLSearchParams({
              amount: amount.toFixed(2),
              item: booking.productSnapshot.name || "Rental item",
              bookingRef: booking.bookingRef,
              paymentLabel,
              returnPath,
              sessionId: `demo_${paymentRecordId}`,
              paymentRecordId,
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
            payment_record_id: paymentRecordId,
            user_id: user.id,
          },
          idempotencyKey: `checkout-${bookingId}-${paymentRecordId}`,
        });

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = documentNumber("INV", booking.bookingRef, invoiceId);
    const invoicePath = `${user.id}/${bookingId}/${invoiceNumber}.pdf`;
    const remainingAfterThis = Math.max(0, balanceDue - amount);

    let invoiceReady = true;
    try {
      await generateAndSaveInvoice(admin, {
        booking,
        invoiceNumber,
        storagePath: invoicePath,
        amountDueNow: amount,
        totalAmount: booking.totalAmount,
        remainingBalance: remainingAfterThis,
        paymentLabel,
      });
    } catch (error) {
      console.error("Invoice PDF generation failed", error);
      return responseError("The invoice could not be prepared. Please try again.", 500);
    }

    await admin.from("payment_records").insert({
      id: paymentRecordId,
      booking_id: bookingId,
      user_id: user.id,
      payment_kind: paymentOption,
      amount,
      status: "pending",
      payment_type: "online",
      external_reference: referenceNumber,
      idempotency_key: `checkout-${bookingId}-${paymentRecordId}`,
      paymongo_checkout_session_id: checkout.id,
      provider_metadata: { checkoutUrl: checkout.checkoutUrl, livemode: checkout.livemode, demo: demoMode },
    });

    await admin.from("booking_invoices").insert({
      id: invoiceId,
      booking_id: bookingId,
      invoice_number: invoiceNumber,
      status: "issued",
      currency_code: "PHP",
      subtotal: booking.rentalSubtotal,
      deposit_amount: booking.refundableDeposit,
      delivery_fee: booking.deliveryFee,
      discount_amount: 0,
      total_amount: booking.totalAmount,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      issued_at: new Date().toISOString(),
      document_path: invoicePath,
    });

    await admin.from("invoice_line_items").insert({
      invoice_id: invoiceId,
      description: `${booking.productSnapshot.name} - ${booking.dayCount} day rental`,
      quantity: 1,
      unit_price: booking.rentalSubtotal,
      line_total: booking.rentalSubtotal,
      sort_order: 0,
    });

    await admin.from("notifications").insert({
      user_id: user.id,
      booking_id: bookingId,
      type: "payment_pending",
      title: demoMode ? "Demo payment checkout ready" : "Payment checkout ready",
      message: demoMode
        ? `Your demo checkout for ${booking.bookingRef} is ready. No real money will be processed.`
        : `Your secure payment checkout for ${booking.bookingRef} is ready.`,
      action_url: `/account/bookings/${bookingId}`,
    });

    await admin.rpc("log_audit_event", {
      p_action: "payment.checkout_created",
      p_entity_type: "payment",
      p_entity_id: paymentRecordId,
      p_booking_id: bookingId,
      p_new_values: { checkoutSessionId: checkout.id, amount, paymentOption, demo: demoMode },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentId: paymentRecordId,
      invoiceNumber,
      invoiceReady,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) return responseError(error.message, error.status);
    if (error instanceof PayMongoError) return responseError(error.message, error.status);
    console.error("Payment checkout creation failed", error);
    return responseError("The secure checkout could not be created. Please try again.", 500);
  }
}
