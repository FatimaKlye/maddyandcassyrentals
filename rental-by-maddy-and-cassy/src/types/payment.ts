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
  storagePath: string;
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
  currency: "PHP";
  storagePath: string;
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
