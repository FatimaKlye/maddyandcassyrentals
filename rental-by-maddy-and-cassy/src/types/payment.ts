// Mirrors public.payment_records / public.payment_event_logs / public.booking_invoices /
// public.booking_receipts (see maddy_cassy_supabase_schema.sql and the
// PayMongo-gap migration). Field names are camelCase; values match the
// Postgres check-constraint vocabulary exactly since RLS policies and the
// booking-confirmation RPC key off these exact strings.

export type PaymentStatus =
  | "pending"
  | "submitted"
  | "processing"
  | "verified"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "rejected";

export type PaymentType = "online" | "manual_proof";
export type RefundStatus = "none" | "partial" | "full";

/** payment_records.payment_kind values used by the checkout flow. */
export type PaymentOption = "deposit_50" | "full" | "balance";

export interface PaymentRecord {
  id: string;
  bookingId: string;
  userId: string;
  paymentKind: string;
  amount: number;
  currency: "PHP";
  status: PaymentStatus;
  paymentType: PaymentType;
  paymentMethod?: string;
  externalReference?: string;
  proofStoragePath?: string;
  paymongoPaymentId?: string;
  paymongoCheckoutSessionId?: string;
  paymongoPaymentIntentId?: string;
  paymongoSourceId?: string;
  providerStatus?: string;
  providerMetadata?: Record<string, unknown>;
  idempotencyKey?: string;
  failureCode?: string;
  failureMessage?: string;
  refundStatus: RefundStatus;
  refundAmount: number;
  submittedAt: string;
  completedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "void"
  | "cancelled"
  | "refunded";

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
}

export interface BookingInvoice {
  id: string;
  bookingId: string;
  invoiceNumber?: string;
  status: InvoiceStatus;
  currencyCode: string;
  subtotal: number;
  depositAmount: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  issuedAt?: string;
  dueAt?: string;
  documentPath?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: InvoiceLineItem[];
}

export interface BookingReceipt {
  id: string;
  bookingId: string;
  paymentRecordId?: string;
  receiptNumber?: string;
  amount: number;
  issuedAt: string;
  documentPath?: string;
  issuedBy?: string;
  isReissue: boolean;
  reissuedFromId?: string;
  reissueReason?: string;
  createdAt: string;
}

export interface PaymentEventLog {
  id: string;
  paymentRecordId: string;
  eventType: string;
  fromStatus?: string;
  toStatus?: string;
  details: Record<string, unknown>;
  actorUserId?: string;
  providerEventId?: string;
  isManualCorrection: boolean;
  createdAt: string;
}

export interface PayMongoWebhookEvent {
  id: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signatureValid: boolean;
  processingStatus: "pending" | "processed" | "ignored" | "failed";
  errorMessage?: string;
  paymentRecordId?: string;
  receivedAt: string;
  processedAt?: string;
}
