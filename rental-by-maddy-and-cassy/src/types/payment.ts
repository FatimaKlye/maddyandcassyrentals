import type { Timestamp } from "firebase/firestore";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "partially_paid"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type InvoiceStatus = "open" | "paid" | "void";

export type PaymentOption = "deposit_50" | "full" | "balance";
export type FinancialDocumentGenerationStatus = "ready" | "pending_retry";

export interface PaymentRecord {
  id: string;
  bookingId: string;
  userId: string;
  bookingRef: string;
  amount: number;
  paymentOption?: PaymentOption;
  isDemo?: boolean;
  currency: "PHP";
  status: PaymentStatus;
  provider: "paymongo";
  checkoutSessionId: string;
  checkoutUrl: string;
  referenceNumber: string;
  paymentId?: string;
  paymentMethod?: string;
  providerPayload?: Record<string, unknown>;
  failureReason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  paidAt?: Timestamp;
}

export interface InvoiceLineItem {
  name: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface BookingInvoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  userId: string;
  bookingRef: string;
  status: InvoiceStatus;
  currency: "PHP";
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  amountDueNow?: number;
  remainingBalance?: number;
  paymentOption?: PaymentOption;
  isDemo?: boolean;
  storagePath: string;
  generationStatus?: FinancialDocumentGenerationStatus;
  paymentId?: string;
  issuedAt: Timestamp;
  dueAt?: Timestamp;
  paidAt?: Timestamp;
  updatedAt: Timestamp;
}

export interface BookingReceipt {
  id: string;
  receiptNumber: string;
  bookingId: string;
  userId: string;
  bookingRef: string;
  paymentId: string;
  providerPaymentId?: string;
  amount: number;
  isDemo?: boolean;
  currency: "PHP";
  storagePath: string;
  generationStatus?: FinancialDocumentGenerationStatus;
  issuedAt: Timestamp;
}

export interface PaymentEventLog {
  id: string;
  type: string;
  livemode: boolean;
  status: "processing" | "processed" | "ignored" | "failed";
  checkoutSessionId?: string;
  bookingId?: string;
  paymentRecordId?: string;
  error?: string;
  createdAt: Timestamp;
  processedAt?: Timestamp;
}
