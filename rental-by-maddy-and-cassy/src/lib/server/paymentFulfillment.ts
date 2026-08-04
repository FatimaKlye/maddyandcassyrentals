import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import { toJson } from "@/src/lib/supabase/types";
import { mapBooking } from "@/src/services/bookingService";
import {
  generateAndSaveFinalAgreement,
  generateAndSaveReceipt,
} from "@/src/lib/server/customerDocuments";

function documentNumber(prefix: string, bookingRef: string, id: string): string {
  const cleanBooking = bookingRef.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
  return `${prefix}-${cleanBooking}-${id.slice(0, 6).toUpperCase()}`;
}

export interface FulfillPaymentInput {
  paymentRecordId: string;
  providerPaymentId: string;
  paymentMethod: string;
  providerStatus?: string;
  providerMetadata?: Record<string, unknown>;
  providerEventId?: string;
}

export interface FulfillPaymentResult {
  alreadyProcessed: boolean;
  bookingId: string;
  bookingConfirmed: boolean;
}

/**
 * Runs every side effect of a verified PayMongo payment: marks the payment
 * paid, updates the matching invoice, issues a receipt (with PDF), logs the
 * event, and — if every other confirmation gate already cleared — flips the
 * booking to 'confirmed' via the service-role-only system_confirm_booking()
 * RPC and finalizes the signed agreement PDF. Called from both the
 * production PayMongo webhook and the sandbox demo-complete route, always
 * with the service-role (RLS-bypassing) admin client, and always after the
 * caller has independently verified the payment is real (signature check or
 * dev-only demo gate) — never from client-supplied status alone.
 */
export async function fulfillVerifiedPayment(
  admin: SupabaseClient<Database>,
  input: FulfillPaymentInput,
): Promise<FulfillPaymentResult> {
  const { data: payment, error: paymentError } = await admin
    .from("payment_records")
    .select("*")
    .eq("id", input.paymentRecordId)
    .single();

  if (paymentError || !payment) {
    throw new Error("PAYMENT_RECORD_NOT_FOUND");
  }

  if (payment.status === "paid" || payment.status === "verified") {
    return { alreadyProcessed: true, bookingId: payment.booking_id, bookingConfirmed: false };
  }

  const { data: bookingRow, error: bookingError } = await admin
    .from("bookings")
    .select("*")
    .eq("id", payment.booking_id)
    .single();
  if (bookingError || !bookingRow) throw new Error("BOOKING_NOT_FOUND");
  const booking = mapBooking(bookingRow);

  const now = new Date().toISOString();
  await admin
    .from("payment_records")
    .update({
      status: "paid",
      paymongo_payment_id: input.providerPaymentId,
      payment_method: input.paymentMethod,
      provider_status: input.providerStatus ?? null,
      provider_metadata: toJson(input.providerMetadata ?? {}),
      completed_at: now,
    })
    .eq("id", payment.id);

  const { data: invoice } = await admin
    .from("booking_invoices")
    .select("*")
    .eq("booking_id", booking.id)
    .eq("status", "issued")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invoice) {
    const newAmountPaid = invoice.amount_paid + payment.amount;
    const balanceDue = Math.max(0, invoice.total_amount - newAmountPaid);
    await admin
      .from("booking_invoices")
      .update({
        amount_paid: newAmountPaid,
        balance_due: balanceDue,
        status: balanceDue <= 0.009 ? "paid" : "partially_paid",
      })
      .eq("id", invoice.id);
  }

  const receiptId = crypto.randomUUID();
  const receiptNumber = documentNumber("OR", booking.bookingRef, receiptId);
  const receiptPath = `${booking.userId}/${booking.id}/${receiptNumber}.pdf`;

  await generateAndSaveReceipt(admin, {
    booking,
    receiptNumber,
    paymentReference: input.providerPaymentId,
    paymentMethod: input.paymentMethod,
    storagePath: receiptPath,
    amount: payment.amount,
  });

  await admin.from("booking_receipts").insert({
    id: receiptId,
    booking_id: booking.id,
    payment_record_id: payment.id,
    receipt_number: receiptNumber,
    amount: payment.amount,
    document_path: receiptPath,
    issued_at: now,
  });

  await admin.from("payment_event_logs").insert({
    payment_record_id: payment.id,
    event_type: "payment.paid",
    from_status: payment.status,
    to_status: "paid",
    details: {
      providerPaymentId: input.providerPaymentId,
      paymentMethod: input.paymentMethod,
    },
    provider_event_id: input.providerEventId ?? null,
  });

  await admin.from("notifications").insert({
    user_id: booking.userId,
    booking_id: booking.id,
    type: "payment_paid",
    title: "Payment confirmed",
    message: `Your payment for ${booking.bookingRef} was verified. Your receipt is ready.`,
    action_url: `/account/bookings/${booking.id}`,
  });

  let bookingConfirmed = false;
  const { data: agreementRow } = await admin
    .from("booking_agreements")
    .select("*")
    .eq("booking_id", booking.id)
    .maybeSingle();

  if (agreementRow?.status === "completed" && booking.status === "approved") {
    const { data: confirmedBooking, error: confirmError } = await admin.rpc(
      "system_confirm_booking",
      { p_booking_id: booking.id, p_note: "Auto-confirmed after verified PayMongo payment." },
    );

    if (!confirmError && confirmedBooking) {
      const confirmed = confirmedBooking as Tables<"bookings">;
      if (confirmed.status === "confirmed") {
        bookingConfirmed = true;
        const { data: signatures } = await admin
          .from("agreement_signatures")
          .select("*")
          .eq("agreement_id", agreementRow.id);

        const agreementPath = `${booking.userId}/${booking.id}/final-agreement-${booking.bookingRef}.pdf`;
        await generateAndSaveFinalAgreement(admin, {
          booking: mapBooking(confirmed),
          agreement: {
            id: agreementRow.id,
            bookingId: agreementRow.booking_id,
            status: agreementRow.status as never,
            agreementVersion: agreementRow.agreement_version ?? undefined,
            versionNumber: agreementRow.version_number,
            agreementSnapshot: agreementRow.agreement_snapshot as never,
            generatedDocumentPath: agreementRow.generated_document_path ?? undefined,
            finalDocumentPath: agreementRow.final_document_path ?? undefined,
            generatedAt: agreementRow.generated_at ?? undefined,
            completedAt: agreementRow.completed_at ?? undefined,
            createdAt: agreementRow.created_at,
            updatedAt: agreementRow.updated_at,
            signatures: (signatures ?? []).map((s) => ({
              id: s.id,
              agreementId: s.agreement_id,
              signerUserId: s.signer_user_id ?? undefined,
              signerRole: s.signer_role as "customer" | "business",
              signerName: s.signer_name,
              signaturePath: s.signature_path ?? undefined,
              signatureData: (s.signature_data as Record<string, unknown>) ?? {},
              signedAt: s.signed_at,
            })),
          },
          paymentReference: input.providerPaymentId,
          storagePath: agreementPath,
        });

        await admin
          .from("booking_agreements")
          .update({ final_document_path: agreementPath })
          .eq("id", agreementRow.id);
      }
    }
  }

  return { alreadyProcessed: false, bookingId: booking.id, bookingConfirmed };
}
