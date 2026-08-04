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
<<<<<<< HEAD
    const result = await fulfillVerifiedPayment(admin, {
      paymentRecordId,
      providerPaymentId: demoReference,
      paymentMethod: `Demo ${paymentMethod.toUpperCase()}`,
      providerStatus: "paid",
      providerMetadata: { demo: true, checkoutSessionId: sessionId },
=======
    const receiptNumber = documentNumber(booking.bookingRef, paymentRecordId);
    const receiptPath =
      `private/users/${user.uid}/bookings/${bookingId}/documents/${receiptNumber}.pdf`;

    let receiptReady = paymentSnapshot.data()?.status === "paid";
    if (!receiptReady) {
      try {
        await generateAndSaveReceipt({
          booking,
          receiptNumber,
          paymentReference: demoReference,
          paymentMethod: `Demo ${paymentMethod.toUpperCase()}`,
          storagePath: receiptPath,
          amount: expectedAmount,
          isDemo: true,
        });
        receiptReady = true;
      } catch (error) {
        // The payment record is the source of truth. A temporary document
        // storage outage must not make a completed demo payment look failed.
        console.error("Demo receipt PDF generation failed", error);
      }
    }

    const now = Timestamp.now();
    await db.runTransaction(async (transaction) => {
      const [latestBooking, latestPayment, latestInvoice] = await transaction.getAll(
        bookingRef,
        paymentRef,
        invoiceRef,
      );
      if (!latestBooking.exists || !latestPayment.exists || !latestInvoice.exists) {
        throw new Error("DEMO_RECORD_MISSING");
      }
      if (latestPayment.data()?.status === "paid") return;

      const bookingData = latestBooking.data() ?? {};
      const totalAmount =
        typeof bookingData.estimatedRentalAmount === "number"
          ? bookingData.estimatedRentalAmount
          : Number(session.totalAmount);
      const previousAmountPaid =
        typeof bookingData.amountPaid === "number" ? bookingData.amountPaid : 0;
      const newAmountPaid = Math.min(totalAmount, previousAmountPaid + expectedAmount);
      const remainingBalance = Math.max(0, totalAmount - newAmountPaid);
      const nextPaymentStatus =
        remainingBalance <= 0.009 ? "paid" : "partially_paid";

      transaction.update(paymentRef, {
        status: "paid",
        isDemo: true,
        paymentId: demoReference,
        paymentMethod: `Demo ${paymentMethod.toUpperCase()}`,
        providerPayload: {
          demo: true,
          checkoutSessionId: sessionId,
          warning: "No real payment was processed.",
        },
        paidAt: now,
        updatedAt: now,
      });
      transaction.update(invoiceRef, {
        status: "paid",
        isDemo: true,
        paidAt: now,
        updatedAt: now,
      });
      transaction.set(bookingRef.collection("receipts").doc(paymentRecordId), {
        id: paymentRecordId,
        receiptNumber,
        bookingId,
        userId: user.uid,
        bookingRef: booking.bookingRef,
        paymentId: paymentRecordId,
        providerPaymentId: demoReference,
        amount: expectedAmount,
        currency: "PHP",
        storagePath: receiptPath,
        generationStatus: receiptReady ? "ready" : "pending_retry",
        isDemo: true,
        issuedAt: now,
      });
      if (receiptReady) {
        transaction.set(bookingRef.collection("documents").doc(`receipt-${paymentRecordId}`), {
          type: "receipt",
          storagePath: receiptPath,
          title: `DEMO Receipt ${receiptNumber} - Not Valid`,
          isDemo: true,
          generatedAt: now,
        });
        transaction.set(bookingRef.collection("documents").doc(`proof-${paymentRecordId}`), {
          type: "payment_proof",
          storagePath: receiptPath,
          title: `DEMO Payment Proof ${demoReference} - Not Valid`,
          isDemo: true,
          generatedAt: now,
        });
      }
      transaction.update(bookingRef, {
        paymentStatus: nextPaymentStatus,
        amountPaid: newAmountPaid,
        balanceDue: remainingBalance,
        paidAt: now,
        paymentReference: demoReference,
        demoPayment: true,
        updatedAt: now,
      });
      transaction.set(bookingRef.collection("statusHistory").doc(), {
        previousStatus: booking.status,
        newStatus: booking.status,
        changedBy: "system",
        message: "Development demo payment completed. No money was processed.",
        createdAt: now,
      });
      transaction.set(db.collection("users").doc(user.uid).collection("notifications").doc(), {
        recipientId: user.uid,
        bookingId,
        type: "payment_paid",
        title: "Demo reservation payment completed",
        message:
          receiptReady
            ? `Your demo payment for ${booking.bookingRef} is complete. No real money was processed.`
            : `Your demo payment for ${booking.bookingRef} is complete. No real money was processed. The receipt will be prepared when document storage is available.`,
        actionUrl: `/account/bookings/${bookingId}`,
        isRead: false,
        createdAt: now,
      });
      transaction.set(db.collection("auditLogs").doc(), {
        action: "payment.demo_completed",
        actorType: "customer",
        actorId: user.uid,
        bookingId,
        targetType: "payment",
        targetId: paymentRecordId,
        metadata: {
          demo: true,
          checkoutSessionId: sessionId,
          amount: expectedAmount,
          remainingBalance,
          receiptReady,
        },
        createdAt: now,
      });
>>>>>>> 33630b5409c8d7d7f3ae7359564ad097aa42a444
    });

    return NextResponse.json({
      success: true,
      bookingId: result.bookingId,
      demo: true,
      receiptReady,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) return responseError(error.message, error.status);
    console.error("Demo payment completion failed", error);
    return responseError("The demo payment could not be completed. Please try again.", 500);
  }
}
