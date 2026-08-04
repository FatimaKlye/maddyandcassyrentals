import { NextResponse } from "next/server";
import { verifyPayMongoSignature, type PayMongoWebhookEvent } from "@/src/lib/paymongo/webhook";
import { fulfillVerifiedPayment } from "@/src/lib/server/paymentFulfillment";
import { sendPushNotification } from "@/src/lib/webpush/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { toJson } from "@/src/lib/supabase/types";

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
    .from("payment_records")
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

  if (payment.status === "paid" || payment.status === "verified") {
    await markEvent({ processing_status: "processed", payment_record_id: payment.id });
    return json("Payment already recorded.", 200);
  }

  const checkoutAttributes = checkout.attributes ?? {};
  const paidPayment = getPaidPayment(checkoutAttributes);
  const paidAttributes = recordValue(paidPayment.attributes);
  const providerPaymentId = stringValue(paidPayment.id, checkoutSessionId);
  const providerAmount = typeof paidAttributes.amount === "number" ? paidAttributes.amount / 100 : null;

  if (providerAmount !== null && Math.abs(providerAmount - payment.amount) > 0.001) {
    await markEvent({
      processing_status: "failed",
      error_message: "Payment amount mismatch.",
      payment_record_id: payment.id,
    });
    return json("Payment amount does not match the booking.", 409);
  }

  const source = recordValue(paidAttributes.source);
  const paymentMethod = stringValue(source.type) || stringValue(paidAttributes.payment_method_type) || "PayMongo";

  let receiptReady = false;
  let agreementReady = false;
  try {
    const result = await fulfillVerifiedPayment(admin, {
      paymentRecordId: payment.id,
      providerPaymentId,
      paymentMethod,
      providerStatus: stringValue(paidAttributes.status, "paid"),
      providerMetadata: { checkoutSessionId, livemode },
      providerEventId: eventId,
    });
<<<<<<< HEAD

    await markEvent({ processing_status: "processed", payment_record_id: payment.id });

    await sendPushNotification(admin, {
      userId: payment.user_id,
      title: "Payment confirmed",
      body: result.bookingConfirmed
        ? "Your booking is confirmed — your rental dates are secured."
        : "Your payment was verified and your receipt is ready.",
      actionUrl: `/account/bookings/${result.bookingId}`,
    }).catch((error) => console.error("Payment push notification failed", error));

    return json("Payment recorded.", 200);
  } catch (error) {
    console.error("PayMongo payment fulfillment failed", error);
    await markEvent({
      processing_status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error.",
      payment_record_id: payment.id,
=======
    receiptReady = true;
  } catch (error) {
    // Payment verification is the source of truth. A receipt upload can be
    // retried later and must never cause a paid PayMongo event to be rejected.
    console.error("Paid booking receipt generation failed", error);
  }

  if (canFinalizeAgreement) {
    try {
      await generateAndSaveFinalAgreement({
        booking,
        agreement: agreementSnapshot.data() ?? {},
        paymentReference: providerPaymentId,
        storagePath: agreementPath,
      });
      agreementReady = true;
    } catch (error) {
      console.error("Paid booking agreement generation failed", error);
    }
  }

  try {
    const now = Timestamp.now();
    await db.runTransaction(async (transaction) => {
      const [latestBooking, latestPayment, latestEvent] = await transaction.getAll(
        bookingRef,
        paymentRef,
        eventRef,
      );
      if (latestPayment.data()?.status === "paid" || latestEvent.data()?.status === "processed") {
        return;
      }
      const latestBookingData = latestBooking.data() ?? {};
      const totalAmount =
        typeof latestBookingData.estimatedRentalAmount === "number"
          ? latestBookingData.estimatedRentalAmount
          : latestBookingData.amountDue;
      const previousAmountPaid =
        typeof latestBookingData.amountPaid === "number"
          ? latestBookingData.amountPaid
          : 0;
      const newAmountPaid = Math.min(
        typeof totalAmount === "number" ? totalAmount : previousAmountPaid + expectedAmount,
        previousAmountPaid + expectedAmount,
      );
      const remainingBalance =
        typeof totalAmount === "number" ? Math.max(0, totalAmount - newAmountPaid) : 0;
      const nextPaymentStatus =
        remainingBalance <= 0.009 ? "paid" : "partially_paid";

      transaction.update(paymentRef, {
        status: "paid",
        paymentId: providerPaymentId,
        paymentMethod,
        providerPayload: {
          checkoutSessionId,
          paymentIntentId: paidAttributes.payment_intent_id ?? null,
          referenceNumber: checkoutAttributes.reference_number ?? session.referenceNumber,
          livemode: event.data.attributes.livemode === true,
        },
        paidAt: now,
        updatedAt: now,
      });
      transaction.update(invoiceRef, {
        status: "paid",
        paidAt: now,
        updatedAt: now,
      });
      transaction.set(bookingRef.collection("receipts").doc(receiptId), {
        id: receiptId,
        receiptNumber,
        bookingId,
        userId,
        bookingRef: booking.bookingRef,
        paymentId: paymentRecordId,
        providerPaymentId,
        amount: expectedAmount,
        currency: "PHP",
        storagePath: receiptPath,
        generationStatus: receiptReady ? "ready" : "pending_retry",
        issuedAt: now,
      });
      if (receiptReady) {
        transaction.set(bookingRef.collection("documents").doc(`receipt-${receiptId}`), {
          type: "receipt",
          storagePath: receiptPath,
          title: `Official Receipt ${receiptNumber}`,
          generatedAt: now,
        });
        transaction.set(bookingRef.collection("documents").doc(`proof-${receiptId}`), {
          type: "payment_proof",
          storagePath: receiptPath,
          title: `Verified PayMongo Payment ${providerPaymentId}`,
          generatedAt: now,
        });
      }

      const bookingUpdates: Record<string, unknown> = {
        paymentStatus: nextPaymentStatus,
        amountPaid: newAmountPaid,
        balanceDue: remainingBalance,
        paidAt: now,
        paymentReference: providerPaymentId,
        updatedAt: now,
      };
      if (agreementReady && booking.status === "approved") {
        bookingUpdates.status = "confirmed";
        bookingUpdates.agreementStatus = "completed";
        bookingUpdates.confirmedAt = now;
      }
      transaction.update(bookingRef, bookingUpdates);

      if (agreementReady) {
        transaction.update(agreementRef, {
          status: "completed",
          finalAgreementPath: agreementPath,
          updatedAt: now,
        });
        transaction.set(bookingRef.collection("documents").doc("final-rental-agreement"), {
          type: "final_rental_agreement",
          storagePath: agreementPath,
          title: "Final Signed Rental Agreement",
          generatedAt: now,
        });
        transaction.set(bookingRef.collection("documents").doc("booking-confirmation"), {
          type: "booking_confirmation",
          storagePath: agreementPath,
          title: "Payment-Aware Booking Confirmation",
          generatedAt: now,
        });
      }

      transaction.set(bookingRef.collection("statusHistory").doc(), {
        previousStatus: booking.status,
        newStatus:
          agreementReady && booking.status === "approved"
            ? "confirmed"
            : booking.status,
        changedBy: "system",
        message: receiptReady
          ? "PayMongo payment verified and receipt issued."
          : "PayMongo payment verified. Receipt generation is pending a document storage retry.",
        createdAt: now,
      });
      transaction.set(db.collection("users").doc(userId).collection("notifications").doc(), {
        recipientId: userId,
        bookingId,
        type: "payment_paid",
        title: "Reservation payment confirmed",
        message: receiptReady
          ? `Your payment for ${booking.bookingRef} was verified. Your rental dates are now secured and your receipt is ready.`
          : `Your payment for ${booking.bookingRef} was verified and your rental dates are secured. Your receipt will be prepared when document storage is available.`,
        actionUrl: `/account/bookings/${bookingId}`,
        isRead: false,
        createdAt: now,
      });
      transaction.set(db.collection("auditLogs").doc(), {
        action: "payment.paid",
        actorType: "system",
        actorId: "paymongo",
        bookingId,
        targetType: "payment",
        targetId: paymentRecordId,
        metadata: {
          checkoutSessionId,
          providerPaymentId,
          amount: expectedAmount,
          paymentOption: session.paymentOption ?? "full",
          remainingBalance,
          receiptReady,
          agreementReady,
        },
        createdAt: now,
      });
      transaction.update(eventRef, {
        status: "processed",
        processedAt: now,
      });
>>>>>>> 33630b5409c8d7d7f3ae7359564ad097aa42a444
    });
    return json("Payment could not be recorded.", 500);
  }
<<<<<<< HEAD
=======

  await sendPushNotification({
    userId,
    title: "Reservation payment confirmed",
    body: receiptReady
      ? `Your payment for ${booking.bookingRef} was verified. Your rental dates are secured and your receipt is ready.`
      : `Your payment for ${booking.bookingRef} was verified and your rental dates are secured. Your receipt is still being prepared.`,
    actionUrl: `/account/bookings/${bookingId}`,
  }).catch((pushError) => console.error("Payment push notification failed", pushError));

  return json("Payment recorded.", 200);
>>>>>>> 33630b5409c8d7d7f3ae7359564ad097aa42a444
}
