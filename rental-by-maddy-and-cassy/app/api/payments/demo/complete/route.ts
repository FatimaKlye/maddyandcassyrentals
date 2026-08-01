import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import { isDemoPaymentEnabled } from "@/src/lib/paymongo/demo";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import { generateAndSaveReceipt } from "@/src/lib/server/customerDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_METHODS = new Set(["gcash", "maya", "qrph", "card"]);

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function documentNumber(bookingRef: string, id: string): string {
  const cleanBooking = bookingRef.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  return `DEMO-OR-${cleanBooking}-${id.slice(0, 6).toUpperCase()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (!isDemoPaymentEnabled()) {
      return responseError("Demo payments are disabled.", 404);
    }
    enforceRateLimit(request, "demo-payment-complete", 8, 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const body = (await request.json().catch(() => null)) as
      | { sessionId?: unknown; paymentMethod?: unknown }
      | null;
    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const paymentMethod =
      typeof body?.paymentMethod === "string" ? body.paymentMethod.trim() : "";

    if (!sessionId.startsWith("demo_") || sessionId.length > 180) {
      return responseError("Choose a valid demo checkout session.", 400);
    }
    if (!DEMO_METHODS.has(paymentMethod)) {
      return responseError("Choose a valid demo payment method.", 400);
    }

    const db = getAdminDb();
    const sessionRef = db.collection("paymentSessions").doc(sessionId);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists || sessionSnapshot.data()?.isDemo !== true) {
      return responseError("The demo checkout session could not be found.", 404);
    }
    const session = sessionSnapshot.data() ?? {};
    if (session.userId !== user.uid) {
      return responseError("You do not have access to this demo checkout.", 403);
    }

    const bookingId = String(session.bookingId ?? "");
    const paymentRecordId = String(session.paymentRecordId ?? "");
    const invoiceId = String(session.invoiceId ?? "");
    const expectedAmount = Number(session.amount);
    if (!bookingId || !paymentRecordId || !invoiceId || !Number.isFinite(expectedAmount)) {
      return responseError("The demo checkout session is incomplete.", 409);
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const paymentRef = bookingRef.collection("payments").doc(paymentRecordId);
    const invoiceRef = bookingRef.collection("invoices").doc(invoiceId);
    const [bookingSnapshot, paymentSnapshot] = await Promise.all([
      bookingRef.get(),
      paymentRef.get(),
    ]);
    if (!bookingSnapshot.exists || !paymentSnapshot.exists) {
      return responseError("The linked demo booking or payment no longer exists.", 409);
    }

    const booking: DocumentData & { id: string } = {
      id: bookingSnapshot.id,
      ...(bookingSnapshot.data() ?? {}),
    };
    if (booking.userId !== user.uid) {
      return responseError("You do not have access to this demo booking.", 403);
    }

    const demoReference = `DEMO-${paymentRecordId.slice(0, 12).toUpperCase()}`;
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
    });

    return NextResponse.json({
      success: true,
      bookingId,
      paymentStatus:
        Number(session.totalAmount) - expectedAmount <= 0.009
          ? "paid"
          : "partially_paid",
      demo: true,
      receiptReady,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return responseError(error.message, error.status);
    }
    console.error("Demo payment completion failed", error);
    return responseError("The demo payment could not be completed. Please try again.", 500);
  }
}
