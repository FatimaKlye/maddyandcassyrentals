import { NextResponse } from "next/server";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceAppCheck,
  enforceRateLimit,
  requireUser,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";
import {
  generateAndSaveInvoice,
  generateAndSaveReceipt,
} from "@/src/lib/server/customerDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "financial-document-retry", 4, 60_000);
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const { bookingId: rawBookingId } = await context.params;
    const bookingId = rawBookingId.trim();
    if (!bookingId || bookingId.length > 150) {
      return responseError("Choose a valid booking.", 400);
    }

    const db = getAdminDb();
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

    const [invoiceSnapshots, receiptSnapshots] = await Promise.all([
      bookingRef.collection("invoices").get(),
      bookingRef.collection("receipts").get(),
    ]);
    const pendingInvoices = invoiceSnapshots.docs.filter(
      (snapshot) => snapshot.data().generationStatus === "pending_retry",
    );
    const pendingReceipts = receiptSnapshots.docs.filter(
      (snapshot) => snapshot.data().generationStatus === "pending_retry",
    );
    let prepared = 0;

    for (const snapshot of pendingInvoices) {
      const invoice = snapshot.data();
      try {
        await generateAndSaveInvoice({
          booking,
          invoiceNumber: String(invoice.invoiceNumber ?? snapshot.id),
          storagePath: String(invoice.storagePath ?? ""),
          amountDueNow: Number(invoice.amountDueNow ?? invoice.subtotal ?? 0),
          totalAmount: Number(invoice.total ?? invoice.subtotal ?? 0),
          remainingBalance: Number(invoice.remainingBalance ?? 0),
          paymentOption: String(invoice.paymentOption ?? "full"),
          isDemo: invoice.isDemo === true,
        });
        const now = Timestamp.now();
        await Promise.all([
          snapshot.ref.update({ generationStatus: "ready", updatedAt: now }),
          bookingRef.collection("documents").doc(`invoice-${snapshot.id}`).set({
            type: "invoice",
            storagePath: invoice.storagePath,
            title: invoice.isDemo === true
              ? `DEMO Invoice ${invoice.invoiceNumber} - Not Valid`
              : `Invoice ${invoice.invoiceNumber}`,
            isDemo: invoice.isDemo === true,
            generatedAt: now,
          }),
        ]);
        prepared += 1;
      } catch (error) {
        console.error("Pending invoice regeneration failed", error);
      }
    }

    for (const snapshot of pendingReceipts) {
      const receipt = snapshot.data();
      const paymentSnapshot = await bookingRef
        .collection("payments")
        .doc(String(receipt.paymentId ?? snapshot.id))
        .get();
      const payment = paymentSnapshot.data() ?? {};
      try {
        await generateAndSaveReceipt({
          booking,
          receiptNumber: String(receipt.receiptNumber ?? snapshot.id),
          paymentReference: String(
            receipt.providerPaymentId ?? payment.paymentId ?? payment.referenceNumber ?? snapshot.id,
          ),
          paymentMethod: String(payment.paymentMethod ?? "PayMongo"),
          storagePath: String(receipt.storagePath ?? ""),
          amount: Number(receipt.amount ?? payment.amount ?? 0),
          isDemo: receipt.isDemo === true,
        });
        const now = Timestamp.now();
        const titlePrefix = receipt.isDemo === true ? "DEMO " : "";
        const invalidSuffix = receipt.isDemo === true ? " - Not Valid" : "";
        const paymentReference = String(
          receipt.providerPaymentId ?? payment.paymentId ?? payment.referenceNumber ?? snapshot.id,
        );
        const batch = db.batch();
        batch.update(snapshot.ref, { generationStatus: "ready" });
        batch.set(bookingRef.collection("documents").doc(`receipt-${snapshot.id}`), {
          type: "receipt",
          storagePath: receipt.storagePath,
          title: `${titlePrefix}Receipt ${receipt.receiptNumber}${invalidSuffix}`,
          isDemo: receipt.isDemo === true,
          generatedAt: now,
        });
        batch.set(bookingRef.collection("documents").doc(`proof-${snapshot.id}`), {
          type: "payment_proof",
          storagePath: receipt.storagePath,
          title: `${titlePrefix}Payment Proof ${paymentReference}${invalidSuffix}`,
          isDemo: receipt.isDemo === true,
          generatedAt: now,
        });
        await batch.commit();
        prepared += 1;
      } catch (error) {
        console.error("Pending receipt regeneration failed", error);
      }
    }

    const attempted = pendingInvoices.length + pendingReceipts.length;
    return NextResponse.json({
      success: true,
      attempted,
      prepared,
      pending: attempted - prepared,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return responseError(error.message, error.status);
    }
    console.error("Financial document retry failed", error);
    return responseError("Pending documents could not be prepared yet.", 500);
  }
}
