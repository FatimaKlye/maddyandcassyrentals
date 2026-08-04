import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import type { BookingInvoice, BookingReceipt, PaymentOption, PaymentRecord } from "@/src/types/payment";

export type { PaymentOption };

export async function createPaymentCheckout(
  bookingId: string,
  paymentOption: PaymentOption = "full",
  returnPath?: string,
): Promise<{ checkoutUrl: string }> {
  const response = await fetch("/api/payments/checkout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, paymentOption, returnPath }),
  });

  const body = (await response.json().catch(() => null)) as
    | { checkoutUrl?: unknown; error?: unknown }
    | null;
  if (!response.ok || typeof body?.checkoutUrl !== "string") {
    throw new Error(
      typeof body?.error === "string" ? body.error : "The secure payment checkout could not be opened.",
    );
  }
  return { checkoutUrl: body.checkoutUrl };
}

<<<<<<< HEAD
export async function completeDemoPayment(
  sessionId: string,
  paymentMethod: string,
): Promise<{ bookingId: string }> {
  const response = await fetch("/api/payments/demo/complete", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, paymentMethod }),
  });
  const body = (await response.json().catch(() => null)) as
    | { bookingId?: unknown; error?: unknown }
    | null;
  if (!response.ok || typeof body?.bookingId !== "string") {
    throw new Error(typeof body?.error === "string" ? body.error : "The demo payment could not be completed.");
  }
  return { bookingId: body.bookingId };
}

function mapPayment(row: Tables<"payment_records">): PaymentRecord {
  return {
    id: row.id,
    bookingId: row.booking_id,
    userId: row.user_id,
    paymentKind: row.payment_kind,
    amount: row.amount,
    currency: "PHP",
    status: row.status as PaymentRecord["status"],
    paymentType: row.payment_type as PaymentRecord["paymentType"],
    paymentMethod: row.payment_method ?? undefined,
    externalReference: row.external_reference ?? undefined,
    proofStoragePath: row.proof_storage_path ?? undefined,
    paymongoPaymentId: row.paymongo_payment_id ?? undefined,
    paymongoCheckoutSessionId: row.paymongo_checkout_session_id ?? undefined,
    refundStatus: row.refund_status as PaymentRecord["refundStatus"],
    refundAmount: row.refund_amount,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
=======
export async function retryPendingFinancialDocuments(
  bookingId: string,
  idToken: string,
): Promise<void> {
  await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/documents/retry`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(await getAppCheckHeaders()),
      },
    },
  );
>>>>>>> 33630b5409c8d7d7f3ae7359564ad097aa42a444
}

export async function getBookingPayments(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from("payment_records")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPayment);
}

export async function getBookingInvoices(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingInvoice[]> {
  const { data, error } = await supabase
    .from("booking_invoices")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): BookingInvoice => ({
      id: row.id,
      bookingId: row.booking_id,
      invoiceNumber: row.invoice_number ?? undefined,
      status: row.status as BookingInvoice["status"],
      currencyCode: row.currency_code,
      subtotal: row.subtotal,
      depositAmount: row.deposit_amount,
      deliveryFee: row.delivery_fee,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount,
      amountPaid: row.amount_paid,
      balanceDue: row.balance_due,
      issuedAt: row.issued_at ?? undefined,
      documentPath: row.document_path ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

export async function getBookingReceipts(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingReceipt[]> {
  const { data, error } = await supabase
    .from("booking_receipts")
    .select("*")
    .eq("booking_id", bookingId)
    .order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): BookingReceipt => ({
      id: row.id,
      bookingId: row.booking_id,
      paymentRecordId: row.payment_record_id ?? undefined,
      receiptNumber: row.receipt_number ?? undefined,
      amount: row.amount,
      issuedAt: row.issued_at,
      documentPath: row.document_path ?? undefined,
      isReissue: row.is_reissue,
      createdAt: row.created_at,
    }),
  );
}
