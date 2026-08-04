import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import { createSignedUrl, type StorageBucket } from "@/src/lib/supabase/storage";
import { mapBooking } from "@/src/services/bookingService";
import type {
  AgreementDoc,
  AgreementSignature,
  BookingDocument,
  EmergencyContact,
  StatusHistoryEntry,
} from "@/src/types/booking";
import type { BookingInvoice, BookingReceipt, PaymentRecord } from "@/src/types/payment";
import type { Booking } from "@/src/types/booking";

function mapDocument(row: Tables<"booking_documents">): BookingDocument {
  return {
    id: row.id,
    bookingId: row.booking_id,
    userId: row.user_id,
    documentType: row.document_type,
    requirementKey: row.requirement_key ?? undefined,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    originalFilename: row.original_filename ?? undefined,
    mimeType: row.mime_type ?? undefined,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    reviewStatus: row.review_status as BookingDocument["reviewStatus"],
    reviewNotes: row.review_notes ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAgreement(
  row: Tables<"booking_agreements">,
  signatures: Tables<"agreement_signatures">[],
): AgreementDoc {
  return {
    id: row.id,
    bookingId: row.booking_id,
    status: row.status as AgreementDoc["status"],
    agreementVersion: row.agreement_version ?? undefined,
    versionNumber: row.version_number,
    agreementSnapshot: row.agreement_snapshot as unknown as AgreementDoc["agreementSnapshot"],
    generatedDocumentPath: row.generated_document_path ?? undefined,
    finalDocumentPath: row.final_document_path ?? undefined,
    generatedAt: row.generated_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    signatures: signatures.map(
      (signature): AgreementSignature => ({
        id: signature.id,
        agreementId: signature.agreement_id,
        signerUserId: signature.signer_user_id ?? undefined,
        signerRole: signature.signer_role as AgreementSignature["signerRole"],
        signerName: signature.signer_name,
        signaturePath: signature.signature_path ?? undefined,
        signatureData: (signature.signature_data as Record<string, unknown>) ?? {},
        ipAddress: signature.ip_address ? String(signature.ip_address) : undefined,
        userAgent: signature.user_agent ?? undefined,
        signedAt: signature.signed_at,
      }),
    ),
  };
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
    paymongoPaymentIntentId: row.paymongo_payment_intent_id ?? undefined,
    paymongoSourceId: row.paymongo_source_id ?? undefined,
    providerStatus: row.provider_status ?? undefined,
    providerMetadata: (row.provider_metadata as Record<string, unknown>) ?? {},
    idempotencyKey: row.idempotency_key ?? undefined,
    failureCode: row.failure_code ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    refundStatus: row.refund_status as PaymentRecord["refundStatus"],
    refundAmount: row.refund_amount,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvoice(row: Tables<"booking_invoices">): BookingInvoice {
  return {
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
    dueAt: row.due_at ?? undefined,
    documentPath: row.document_path ?? undefined,
    voidReason: row.void_reason ?? undefined,
    voidedBy: row.voided_by ?? undefined,
    voidedAt: row.voided_at ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReceipt(row: Tables<"booking_receipts">): BookingReceipt {
  return {
    id: row.id,
    bookingId: row.booking_id,
    paymentRecordId: row.payment_record_id ?? undefined,
    receiptNumber: row.receipt_number ?? undefined,
    amount: row.amount,
    issuedAt: row.issued_at,
    documentPath: row.document_path ?? undefined,
    issuedBy: row.issued_by ?? undefined,
    isReissue: row.is_reissue,
    reissuedFromId: row.reissued_from_id ?? undefined,
    reissueReason: row.reissue_reason ?? undefined,
    createdAt: row.created_at,
  };
}

function mapStatusHistory(row: Tables<"booking_status_history">): StatusHistoryEntry {
  return {
    id: row.id,
    bookingId: row.booking_id,
    fromStatus: (row.from_status as StatusHistoryEntry["fromStatus"]) ?? null,
    toStatus: row.to_status as StatusHistoryEntry["toStatus"],
    note: row.note ?? undefined,
    changedByUserId: row.changed_by ?? undefined,
    createdAt: row.created_at,
  };
}

function mapEmergencyContact(row: Tables<"booking_emergency_contacts">): EmergencyContact {
  return {
    id: row.id,
    bookingId: row.booking_id,
    fullName: row.full_name,
    relationship: row.relationship,
    phoneNumber: row.phone_number,
    address: row.address ?? undefined,
  };
}

export interface BookingDetails {
  booking: Booking;
  emergencyContact: EmergencyContact | null;
  agreement: AgreementDoc | null;
  statusHistory: StatusHistoryEntry[];
  documents: BookingDocument[];
  payments: PaymentRecord[];
  invoices: BookingInvoice[];
  receipts: BookingReceipt[];
}

export async function getBookingDetails(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingDetails | null> {
  const { data: bookingRow, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !bookingRow) return null;

  const [
    { data: emergencyContact },
    { data: agreementRow },
    { data: statusHistory },
    { data: documents },
    { data: payments },
    { data: invoices },
    { data: receipts },
  ] = await Promise.all([
    supabase.from("booking_emergency_contacts").select("*").eq("booking_id", bookingId).maybeSingle(),
    supabase.from("booking_agreements").select("*").eq("booking_id", bookingId).maybeSingle(),
    supabase
      .from("booking_status_history")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
    supabase.from("booking_documents").select("*").eq("booking_id", bookingId),
    supabase.from("payment_records").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }),
    supabase.from("booking_invoices").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }),
    supabase.from("booking_receipts").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }),
  ]);

  let agreement: AgreementDoc | null = null;
  if (agreementRow) {
    const { data: signatures } = await supabase
      .from("agreement_signatures")
      .select("*")
      .eq("agreement_id", agreementRow.id);
    agreement = mapAgreement(agreementRow, signatures ?? []);
  }

  return {
    booking: mapBooking(bookingRow),
    emergencyContact: emergencyContact ? mapEmergencyContact(emergencyContact) : null,
    agreement,
    statusHistory: (statusHistory ?? []).map(mapStatusHistory),
    documents: (documents ?? []).map(mapDocument),
    payments: (payments ?? []).map(mapPayment),
    invoices: (invoices ?? []).map(mapInvoice),
    receipts: (receipts ?? []).map(mapReceipt),
  };
}

export async function getBookingFileUrl(
  supabase: SupabaseClient<Database>,
  bucket: StorageBucket,
  storagePath: string,
): Promise<string> {
  return createSignedUrl(supabase, bucket, storagePath);
}
