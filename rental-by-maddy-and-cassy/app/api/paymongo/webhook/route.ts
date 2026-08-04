import { NextResponse } from "next/server";
import { verifyPayMongoSignature, type PayMongoWebhookEvent } from "@/src/lib/paymongo/webhook";
import { fulfillVerifiedPayment } from "@/src/lib/server/paymentFulfillment";
import { sendPushNotification } from "@/src/lib/webpush/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { toJson } from "@/src/lib/supabase/types";
import { getBookingById } from "@/src/services/bookingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(message: string, status: number) {
  return NextResponse.json({ received: status >= 200 && status < 300, message }, { status });
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getPaidPayment(checkoutAttributes: Record<string, unknown>): Record<string, unknown> {
  const payments = Array.isArray(checkoutAttributes.payments) ? checkoutAttributes.payments : [];
  return recordValue(
    payments.find(
      (payment) => recordValue(recordValue(payment).attributes).status === "paid",
    ) ?? payments[0],
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();

  try {
    verifyPayMongoSignature(
      rawBody,
      request.headers.get("paymongo-signature") ?? request.headers.get("x-paymongo-signature"),
    );
  } catch (error) {
    console.warn("Rejected PayMongo webhook", error);
    return json("Invalid webhook signature.", 401);
  }

  let event: PayMongoWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PayMongoWebhookEvent;
  } catch {
    return json("Invalid JSON payload.", 400);
  }

  const eventId = event.data?.id;
  const eventType = event.data?.attributes?.type;
  if (!eventId || !eventType) return json("Invalid event payload.", 400);

  const admin = createAdminClient();

  // Idempotency: provider_event_id is unique, so a concurrent/duplicate
  // delivery either loses this insert race (and we read the winner's row)
  // or wins it and proceeds normally.
  const { data: insertedEvent, error: insertError } = await admin
    .from("paymongo_webhook_events")
    .insert({
      provider_event_id: eventId,
      event_type: eventType,
      payload: toJson(event),
      signature_valid: true,
      processing_status: "pending",
    })
    .select("*")
    .single();

  let eventRowId: string;
  if (insertError) {
    const { data: existing } = await admin
      .from("paymongo_webhook_events")
      .select("*")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (!existing) return json("Could not record webhook event.", 500);
    if (existing.processing_status === "processed") {
      return json("Event already processed.", 200);
    }
    eventRowId = existing.id;
  } else {
    eventRowId = insertedEvent.id;
  }

  async function markEvent(update: {
    processing_status: "processed" | "ignored" | "failed";
    error_message?: string;
    payment_record_id?: string;
  }) {
    await admin
      .from("paymongo_webhook_events")
      .update({ ...update, processed_at: new Date().toISOString() })
      .eq("id", eventRowId);
  }

  if (eventType !== "checkout_session.payment.paid") {
    await markEvent({ processing_status: "ignored" });
    return json("Event ignored.", 200);
  }

  const checkout = event.data.attributes.data;
  const checkoutSessionId = checkout?.id;
  if (!checkoutSessionId) {
    await markEvent({ processing_status: "failed", error_message: "Missing checkout session id." });
    return json("Checkout session is missing.", 400);
  }

  const { data: payment } = await admin
    .from("booking_payment_submissions")
    .select("*")
    .eq("paymongo_checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (!payment) {
    await markEvent({ processing_status: "failed", error_message: "Unknown checkout session." });
    return json("Unknown checkout session.", 409);
  }

  const livemode = event.data.attributes.livemode === true;
  const sessionMeta = (payment.provider_metadata as Record<string, unknown>) ?? {};
  if (typeof sessionMeta.livemode === "boolean" && sessionMeta.livemode !== livemode) {
    await markEvent({
      processing_status: "failed",
      error_message: "Webhook mode does not match the checkout session.",
      payment_record_id: payment.id,
    });
    return json("Webhook mode does not match the checkout session.", 409);
  }

  if (payment.status === "verified") {
    await markEvent({ processing_status: "processed", payment_record_id: payment.id });
    return json("Payment already recorded.", 200);
  }

  const checkoutAttributes = checkout.attributes ?? {};
  const paidPayment = getPaidPayment(checkoutAttributes);
  const paidAttributes = recordValue(paidPayment.attributes);
  const providerPaymentId = stringValue(paidPayment.id, checkoutSessionId);
  const providerAmount = typeof paidAttributes.amount === "number" ? paidAttributes.amount / 100 : null;

  if (providerAmount !== null && Math.abs(providerAmount - payment.declared_amount) > 0.001) {
    await markEvent({
      processing_status: "failed",
      error_message: "Payment amount mismatch.",
      payment_record_id: payment.id,
    });
    return json("Payment amount does not match the booking.", 409);
  }

  const source = recordValue(paidAttributes.source);
  const paymentMethod = stringValue(source.type) || stringValue(paidAttributes.payment_method_type) || "PayMongo";

  try {
    const result = await fulfillVerifiedPayment(admin, {
      paymentSubmissionId: payment.id,
      providerPaymentId,
      paymentMethod,
      providerStatus: stringValue(paidAttributes.status, "paid"),
      providerMetadata: { checkoutSessionId, livemode },
      providerEventId: eventId,
    });

    await markEvent({ processing_status: "processed", payment_record_id: payment.id });

    const booking = await getBookingById(admin, payment.booking_id);
    if (booking) {
      await sendPushNotification(admin, {
        userId: booking.customerId,
        title: "Payment confirmed",
        body: result.bookingConfirmed
          ? "Your booking is confirmed — your rental dates are secured."
          : "Your payment was verified and your receipt is ready.",
        actionUrl: `/account/bookings/${result.bookingId}`,
      }).catch((error) => console.error("Payment push notification failed", error));
    }

    return json("Payment recorded.", 200);
  } catch (error) {
    console.error("PayMongo payment fulfillment failed", error);
    await markEvent({
      processing_status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error.",
      payment_record_id: payment.id,
    });
    return json("Payment could not be recorded.", 500);
  }
}
