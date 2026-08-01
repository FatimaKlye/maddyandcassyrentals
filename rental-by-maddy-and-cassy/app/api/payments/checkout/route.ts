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
import type { PaymentOption } from "@/src/types/payment";
import { isDemoPaymentEnabled } from "@/src/lib/paymongo/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function documentNumber(prefix: string, bookingRef: string, id: string): string {
  const cleanBooking = bookingRef.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  return `${prefix}-${cleanBooking}-${id.slice(0, 6).toUpperCase()}`;
}

function isPaymentOption(value: unknown): value is PaymentOption {
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
    await enforceAppCheck(request);
    const user = await requireUser(request);
    const db = getAdminDb();

    const body = (await request.json().catch(() => null)) as
      | { bookingId?: unknown; paymentOption?: unknown; returnPath?: unknown }
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
    if (
      !["submitted", "under_review", "correction_required", "approved", "confirmed"].includes(
        booking.status,
      )
    ) {
      return responseError(
        "Payment is not available for this booking.",
        409,
      );
    }
    const paymentOption = isPaymentOption(body?.paymentOption)
      ? body.paymentOption
      : "full";
    if (booking.paymentStatus === "paid" && paymentOption !== "balance") {
      return responseError("This booking is already paid.", 409);
    }

    const configuredTotal = booking.estimatedRentalAmount ?? booking.amountDue;
    const amountPaid =
      typeof booking.amountPaid === "number" && Number.isFinite(booking.amountPaid)
        ? booking.amountPaid
        : 0;
    if (
      typeof configuredTotal !== "number" ||
      !Number.isFinite(configuredTotal) ||
      configuredTotal <= 0
    ) {
      return responseError("The booking amount is not configured correctly.", 409);
    }
    const totalAmount = configuredTotal;
    const balanceDue = Math.max(0, totalAmount - amountPaid);
    if (balanceDue <= 0) {
      return responseError("This booking is already paid.", 409);
    }
    const amount =
      paymentOption === "deposit_50" && amountPaid === 0
        ? Math.round(totalAmount * 50) / 100
        : paymentOption === "balance"
          ? balanceDue
          : balanceDue;
    const amountCentavos = Math.round(amount * 100);
    if (amountCentavos < 100) {
      return responseError("The booking amount is below the payment minimum.", 409);
    }
    const demoMode = isDemoPaymentEnabled();

    const reusablePayments = await bookingRef
      .collection("payments")
      .where("status", "==", "pending")
      .limit(1)
      .get();
    const reusable = reusablePayments.docs[0]?.data();
    if (
      reusable &&
      typeof reusable.checkoutUrl === "string" &&
      reusable.amount === amount &&
      reusable.paymentOption === paymentOption &&
      reusable.isDemo === demoMode &&
      (!demoMode || reusable.checkoutUrl.includes("sessionId="))
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
    const returnPath = safeReturnPath(
      body?.returnPath,
      `/account/bookings/${bookingId}`,
    );
    const returnUrl = `${appOrigin}${returnPath}`;
    const returnSeparator = returnUrl.includes("?") ? "&" : "?";
    const customer = booking.customerSnapshot ?? {};
    const paymentLabel =
      paymentOption === "deposit_50"
        ? "50% reservation payment"
        : paymentOption === "balance"
          ? "Remaining rental balance"
          : "Full rental payment";

    const checkout = demoMode
      ? {
          id: `demo_${paymentRef.id}`,
          checkoutUrl:
            `${appOrigin}/demo/paymongo?` +
            new URLSearchParams({
              amount: amount.toFixed(2),
              item: booking.productSnapshot?.name || "Rental item",
              bookingRef: booking.bookingRef,
              paymentLabel,
              returnPath,
              sessionId: `demo_${paymentRef.id}`,
            }).toString(),
          livemode: false,
        }
      : await createCheckoutSession({
          amountCentavos,
          productName: booking.productSnapshot?.name || "Rental item",
          bookingRef: booking.bookingRef,
          referenceNumber,
          customer: {
            name: customer.fullName || user.name || "Customer",
            email: customer.email || user.email || "",
            phone: customer.phone || "",
          },
          paymentLabel,
          successUrl: `${returnUrl}${returnSeparator}payment=success`,
          cancelUrl: `${returnUrl}${returnSeparator}payment=cancelled`,
          metadata: {
            booking_id: bookingId,
            payment_record_id: paymentRef.id,
            user_id: user.uid,
            invoice_id: invoiceRef.id,
            payment_option: paymentOption,
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
      totalAmount,
      paymentOption,
      currency: "PHP",
      referenceNumber,
      livemode: checkout.livemode,
      isDemo: demoMode,
      createdAt: now,
    });

    let invoiceReady = true;
    try {
      await generateAndSaveInvoice({
        booking,
        invoiceNumber,
        storagePath: invoicePath,
        amountDueNow: amount,
        totalAmount,
        remainingBalance: Math.max(0, balanceDue - amount),
        paymentOption,
        isDemo: demoMode,
      });
    } catch (error) {
      console.error("Invoice PDF generation failed", error);
      invoiceReady = false;
    }

    const batch = db.batch();
    batch.set(paymentRef, {
      id: paymentRef.id,
      bookingId,
      userId: user.uid,
      bookingRef: booking.bookingRef,
      amount,
      paymentOption,
      isDemo: demoMode,
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
      total: totalAmount,
      amountDueNow: amount,
      remainingBalance: Math.max(0, balanceDue - amount),
      paymentOption,
      isDemo: demoMode,
      storagePath: invoicePath,
      generationStatus: invoiceReady ? "ready" : "pending_retry",
      paymentId: paymentRef.id,
      issuedAt: now,
      updatedAt: now,
    });
    if (invoiceReady) {
      batch.set(bookingRef.collection("documents").doc(`invoice-${invoiceRef.id}`), {
        type: "invoice",
        storagePath: invoicePath,
        title: demoMode
          ? `DEMO Invoice ${invoiceNumber} - Not Valid`
          : `Invoice ${invoiceNumber}`,
        isDemo: demoMode,
        generatedAt: now,
      });
    }
    batch.update(bookingRef, {
      amountDue: totalAmount,
      balanceDue,
      paymentChoice: paymentOption,
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
      metadata: {
        checkoutSessionId: checkout.id,
        amount,
        paymentOption,
        demo: demoMode,
        invoiceReady,
      },
      createdAt: now,
    });
    batch.set(db.collection("users").doc(user.uid).collection("notifications").doc(), {
      recipientId: user.uid,
      bookingId,
      type: "payment_pending",
      title: demoMode ? "Demo payment checkout ready" : "Payment checkout ready",
      message: demoMode
        ? `Your demo checkout for ${booking.bookingRef} is ready. No real money will be processed.`
        : `Your secure payment checkout for ${booking.bookingRef} is ready.`,
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
      invoiceReady,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return responseError(error.message, error.status);
    }
    if (error instanceof PayMongoError) {
      return responseError(error.message, error.status);
    }
    console.error("Payment checkout creation failed", error);
    return responseError("The secure checkout could not be created. Please try again.", 500);
  }
}
