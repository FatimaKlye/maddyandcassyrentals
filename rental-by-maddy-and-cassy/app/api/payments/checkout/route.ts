import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import { createCheckoutSession, PayMongoError } from "@/src/lib/paymongo/client";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import { generateAndSaveInvoice } from "@/src/lib/server/customerDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function documentNumber(prefix: string, bookingRef: string, id: string): string {
  const cleanBooking = bookingRef.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  return `${prefix}-${cleanBooking}-${id.slice(0, 6).toUpperCase()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "payment-checkout", 8, 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const db = getAdminDb();

    const body = (await request.json().catch(() => null)) as
      | { bookingId?: unknown }
      | null;
    const bookingId =
      typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId || bookingId.length > 150) {
      return responseError("Choose a valid booking to pay.", 400);
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnapshot = await bookingRef.get();
    if (!bookingSnapshot.exists) {
      return responseError("The selected booking could not be found.", 404);
    }

    const booking: DocumentData & { id: string } = {
      id: bookingSnapshot.id,
      ...(bookingSnapshot.data() ?? {}),
    };
    if (booking.userId !== user.uid) {
      return responseError("You do not have access to this booking.", 403);
    }
    if (!["approved", "confirmed"].includes(booking.status)) {
      return responseError(
        "Payment becomes available after the booking and requirements are approved.",
        409,
      );
    }
    if (booking.paymentStatus === "paid") {
      return responseError("This booking is already paid.", 409);
    }

    const amount = booking.amountDue ?? booking.estimatedRentalAmount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return responseError("The booking amount is not configured correctly.", 409);
    }
    const amountCentavos = Math.round(amount * 100);
    if (amountCentavos < 100) {
      return responseError("The booking amount is below the payment minimum.", 409);
    }

    const reusablePayments = await bookingRef
      .collection("payments")
      .where("status", "==", "pending")
      .limit(1)
      .get();
    const reusable = reusablePayments.docs[0]?.data();
    if (
      reusable &&
      typeof reusable.checkoutUrl === "string" &&
      reusable.amount === amount
    ) {
      return NextResponse.json({
        success: true,
        checkoutUrl: reusable.checkoutUrl,
        paymentId: reusablePayments.docs[0].id,
        reused: true,
      });
    }

    const paymentRef = bookingRef.collection("payments").doc();
    const invoiceRef = bookingRef.collection("invoices").doc();
    const referenceNumber = `${booking.bookingRef}-${paymentRef.id.slice(0, 8)}`;
    const invoiceNumber = documentNumber("INV", booking.bookingRef, invoiceRef.id);
    const invoicePath =
      `private/users/${user.uid}/bookings/${bookingId}/documents/${invoiceNumber}.pdf`;
    const appOrigin =
      process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const returnUrl = `${appOrigin}/account/bookings/${bookingId}`;
    const customer = booking.customerSnapshot ?? {};

    const checkout = await createCheckoutSession({
      amountCentavos,
      productName: booking.productSnapshot?.name || "Rental item",
      bookingRef: booking.bookingRef,
      referenceNumber,
      customer: {
        name: customer.fullName || user.name || "Customer",
        email: customer.email || user.email || "",
        phone: customer.phone || "",
      },
      successUrl: `${returnUrl}?payment=success`,
      cancelUrl: `${returnUrl}?payment=cancelled`,
      metadata: {
        booking_id: bookingId,
        payment_record_id: paymentRef.id,
        user_id: user.uid,
        invoice_id: invoiceRef.id,
      },
      idempotencyKey: `checkout-${bookingId}-${paymentRef.id}`,
    });

    const now = Timestamp.now();
    await db.collection("paymentSessions").doc(checkout.id).set({
      checkoutSessionId: checkout.id,
      bookingId,
      paymentRecordId: paymentRef.id,
      invoiceId: invoiceRef.id,
      userId: user.uid,
      amount,
      currency: "PHP",
      referenceNumber,
      livemode: checkout.livemode,
      createdAt: now,
    });

    try {
      await generateAndSaveInvoice({
        booking,
        invoiceNumber,
        storagePath: invoicePath,
      });
    } catch (error) {
      console.error("Invoice PDF generation failed", error);
      await db.collection("paymentSessions").doc(checkout.id).delete();
      throw new Error("INVOICE_GENERATION_FAILED");
    }

    const batch = db.batch();
    batch.set(paymentRef, {
      id: paymentRef.id,
      bookingId,
      userId: user.uid,
      bookingRef: booking.bookingRef,
      amount,
      currency: "PHP",
      status: "pending",
      provider: "paymongo",
      checkoutSessionId: checkout.id,
      checkoutUrl: checkout.checkoutUrl,
      referenceNumber,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(invoiceRef, {
      id: invoiceRef.id,
      invoiceNumber,
      bookingId,
      userId: user.uid,
      bookingRef: booking.bookingRef,
      status: "open",
      currency: "PHP",
      lineItems: [
        {
          name: booking.productSnapshot?.name || "Rental item",
          description: `${booking.dayCount} day rental`,
          quantity: 1,
          unitAmount: amount,
          amount,
        },
      ],
      subtotal: amount,
      total: amount,
      storagePath: invoicePath,
      paymentId: paymentRef.id,
      issuedAt: now,
      updatedAt: now,
    });
    batch.set(bookingRef.collection("documents").doc(`invoice-${invoiceRef.id}`), {
      type: "invoice",
      storagePath: invoicePath,
      title: `Invoice ${invoiceNumber}`,
      generatedAt: now,
    });
    batch.update(bookingRef, {
      amountDue: amount,
      paymentRequired: true,
      paymentStatus: "pending",
      activePaymentId: paymentRef.id,
      updatedAt: now,
    });
    batch.set(db.collection("auditLogs").doc(), {
      action: "payment.checkout_created",
      actorType: "customer",
      actorId: user.uid,
      bookingId,
      targetType: "payment",
      targetId: paymentRef.id,
      metadata: { checkoutSessionId: checkout.id, amount },
      createdAt: now,
    });
    batch.set(db.collection("users").doc(user.uid).collection("notifications").doc(), {
      recipientId: user.uid,
      bookingId,
      type: "payment_pending",
      title: "Payment checkout ready",
      message: `Your secure payment checkout for ${booking.bookingRef} is ready.`,
      actionUrl: `/account/bookings/${bookingId}`,
      isRead: false,
      createdAt: now,
    });
    await batch.commit();

    return NextResponse.json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentId: paymentRef.id,
      invoiceNumber,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return responseError(error.message, error.status);
    }
    if (error instanceof PayMongoError) {
      return responseError(error.message, error.status);
    }
    if (error instanceof Error && error.message === "INVOICE_GENERATION_FAILED") {
      return responseError("The invoice could not be prepared. Please try again.", 500);
    }
    console.error("Payment checkout creation failed", error);
    return responseError("The secure checkout could not be created. Please try again.", 500);
  }
}
