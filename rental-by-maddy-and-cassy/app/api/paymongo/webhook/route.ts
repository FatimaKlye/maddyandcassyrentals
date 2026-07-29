import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  verifyPayMongoSignature,
  type PayMongoWebhookEvent,
} from "@/src/lib/paymongo/webhook";
import {
  generateAndSaveFinalAgreement,
  generateAndSaveReceipt,
} from "@/src/lib/server/customerDocuments";
import { sendPushNotification } from "@/src/lib/server/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(message: string, status: number) {
  return NextResponse.json({ received: status >= 200 && status < 300, message }, { status });
}

function recordValue(
  value: unknown,
): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getPaidPayment(
  checkoutAttributes: Record<string, unknown>,
): Record<string, unknown> {
  const payments = Array.isArray(checkoutAttributes.payments)
    ? checkoutAttributes.payments
    : [];
  return recordValue(
    payments.find((payment) => recordValue(payment).attributes &&
      recordValue(recordValue(payment).attributes).status === "paid") ??
      payments[0],
  );
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function documentNumber(prefix: string, bookingRef: string, id: string): string {
  const cleanBooking = bookingRef.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  return `${prefix}-${cleanBooking}-${id.slice(0, 6).toUpperCase()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  try {
    verifyPayMongoSignature(
      rawBody,
      request.headers.get("paymongo-signature") ??
        request.headers.get("x-paymongo-signature"),
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
  if (!eventId || !eventType) {
    return json("Invalid event payload.", 400);
  }

  const db = getAdminDb();
  const eventRef = db.collection("paymentEvents").doc(eventId);
  const existingEvent = await eventRef.get();
  if (existingEvent.exists && existingEvent.data()?.status === "processed") {
    return json("Event already processed.", 200);
  }

  if (eventType !== "checkout_session.payment.paid") {
    await eventRef.set(
      {
        id: eventId,
        type: eventType,
        livemode: event.data.attributes.livemode === true,
        status: "ignored",
        createdAt: Timestamp.now(),
        processedAt: Timestamp.now(),
      },
      { merge: true },
    );
    return json("Event ignored.", 200);
  }

  const checkout = event.data.attributes.data;
  const checkoutSessionId = checkout?.id;
  if (!checkoutSessionId) {
    return json("Checkout session is missing.", 400);
  }

  const sessionSnapshot = await db
    .collection("paymentSessions")
    .doc(checkoutSessionId)
    .get();
  if (!sessionSnapshot.exists) {
    await eventRef.set(
      {
        id: eventId,
        type: eventType,
        livemode: event.data.attributes.livemode === true,
        checkoutSessionId,
        status: "failed",
        error: "Unknown checkout session.",
        createdAt: Timestamp.now(),
      },
      { merge: true },
    );
    return json("Unknown checkout session.", 409);
  }

  const session = sessionSnapshot.data() ?? {};
  if (
    typeof session.livemode === "boolean" &&
    session.livemode !== (event.data.attributes.livemode === true)
  ) {
    return json("Webhook mode does not match the checkout session.", 409);
  }

  const bookingId = stringValue(session.bookingId);
  const paymentRecordId = stringValue(session.paymentRecordId);
  const invoiceId = stringValue(session.invoiceId);
  const userId = stringValue(session.userId);
  const bookingRef = db.collection("bookings").doc(bookingId);
  const paymentRef = bookingRef.collection("payments").doc(paymentRecordId);
  const invoiceRef = bookingRef.collection("invoices").doc(invoiceId);
  const agreementRef = bookingRef.collection("agreement").doc("main");

  const [bookingSnapshot, paymentSnapshot, agreementSnapshot] = await Promise.all([
    bookingRef.get(),
    paymentRef.get(),
    agreementRef.get(),
  ]);
  if (!bookingSnapshot.exists || !paymentSnapshot.exists) {
    return json("The linked booking or payment no longer exists.", 409);
  }
  if (paymentSnapshot.data()?.status === "paid") {
    await eventRef.set(
      {
        id: eventId,
        type: eventType,
        checkoutSessionId,
        bookingId,
        paymentRecordId,
        livemode: event.data.attributes.livemode === true,
        status: "processed",
        processedAt: Timestamp.now(),
        createdAt: existingEvent.data()?.createdAt ?? Timestamp.now(),
      },
      { merge: true },
    );
    return json("Payment already recorded.", 200);
  }

  await eventRef.set(
    {
      id: eventId,
      type: eventType,
      checkoutSessionId,
      bookingId,
      paymentRecordId,
      livemode: event.data.attributes.livemode === true,
      status: "processing",
      createdAt: existingEvent.data()?.createdAt ?? Timestamp.now(),
    },
    { merge: true },
  );

  const booking: DocumentData & { id: string } = {
    id: bookingSnapshot.id,
    ...(bookingSnapshot.data() ?? {}),
  };
  const checkoutAttributes = checkout.attributes ?? {};
  const paidPayment = getPaidPayment(checkoutAttributes);
  const paidAttributes = recordValue(paidPayment.attributes);
  const providerPaymentId = stringValue(paidPayment.id, checkoutSessionId);
  const providerAmount =
    typeof paidAttributes.amount === "number" ? paidAttributes.amount / 100 : session.amount;
  const expectedAmount = session.amount;
  if (
    typeof providerAmount === "number" &&
    typeof expectedAmount === "number" &&
    Math.abs(providerAmount - expectedAmount) > 0.001
  ) {
    await eventRef.set(
      {
        status: "failed",
        error: "Payment amount mismatch.",
        processedAt: Timestamp.now(),
      },
      { merge: true },
    );
    return json("Payment amount does not match the booking.", 409);
  }

  const source = recordValue(paidAttributes.source);
  const paymentMethod =
    stringValue(source.type) ||
    stringValue(paidAttributes.payment_method_type) ||
    "PayMongo";
  const receiptId = paymentRecordId;
  const receiptNumber = documentNumber("OR", booking.bookingRef, receiptId);
  const receiptPath =
    `private/users/${userId}/bookings/${bookingId}/documents/${receiptNumber}.pdf`;
  const agreementPath =
    `private/users/${userId}/bookings/${bookingId}/documents/final-agreement-${booking.bookingRef}.pdf`;
  const canFinalizeAgreement =
    agreementSnapshot.exists && booking.requirementsStatus === "verified";

  try {
    await generateAndSaveReceipt({
      booking,
      receiptNumber,
      paymentReference: providerPaymentId,
      paymentMethod,
      storagePath: receiptPath,
    });
    if (canFinalizeAgreement) {
      await generateAndSaveFinalAgreement({
        booking,
        agreement: agreementSnapshot.data() ?? {},
        paymentReference: providerPaymentId,
        storagePath: agreementPath,
      });
    }
  } catch (error) {
    console.error("Paid booking document generation failed", error);
    await eventRef.set(
      {
        status: "failed",
        error: "Customer document generation failed.",
        processedAt: Timestamp.now(),
      },
      { merge: true },
    );
    return json("Payment documents could not be finalized.", 500);
  }

  try {
    const now = Timestamp.now();
    await db.runTransaction(async (transaction) => {
      const [latestPayment, latestEvent] = await transaction.getAll(paymentRef, eventRef);
      if (latestPayment.data()?.status === "paid" || latestEvent.data()?.status === "processed") {
        return;
      }

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
        issuedAt: now,
      });
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

      const bookingUpdates: Record<string, unknown> = {
        paymentStatus: "paid",
        paidAt: now,
        paymentReference: providerPaymentId,
        updatedAt: now,
      };
      if (canFinalizeAgreement && booking.status === "approved") {
        bookingUpdates.status = "confirmed";
        bookingUpdates.agreementStatus = "completed";
        bookingUpdates.confirmedAt = now;
      }
      transaction.update(bookingRef, bookingUpdates);

      if (canFinalizeAgreement) {
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
          canFinalizeAgreement && booking.status === "approved"
            ? "confirmed"
            : booking.status,
        changedBy: "system",
        message: "PayMongo payment verified and receipt issued.",
        createdAt: now,
      });
      transaction.set(db.collection("users").doc(userId).collection("notifications").doc(), {
        recipientId: userId,
        bookingId,
        type: "payment_paid",
        title: "Payment confirmed",
        message: `Your payment for ${booking.bookingRef} was verified. Your receipt is ready.`,
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
        },
        createdAt: now,
      });
      transaction.update(eventRef, {
        status: "processed",
        processedAt: now,
      });
    });
  } catch (error) {
    console.error("PayMongo payment persistence failed", error);
    await eventRef.set(
      { status: "failed", error: "Database update failed.", processedAt: Timestamp.now() },
      { merge: true },
    );
    return json("Payment could not be recorded.", 500);
  }

  await sendPushNotification({
    userId,
    title: "Payment confirmed",
    body: `Your payment for ${booking.bookingRef} was verified. Your receipt is ready.`,
    actionUrl: `/account/bookings/${bookingId}`,
  }).catch((pushError) => console.error("Payment push notification failed", pushError));

  return json("Payment recorded.", 200);
}
