import type { DocumentData } from "firebase-admin/firestore";
import { getAdminStorage } from "@/src/lib/firebase/admin";
import {
  createFinalAgreementPdf,
  createInvoicePdf,
  createReceiptPdf,
} from "@/src/lib/pdf/customerDocuments";

function toDate(value: unknown): Date | null {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function formatDate(value: unknown, withTime = false): string {
  const date = toDate(value) ?? (value instanceof Date ? value : new Date());
  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export async function savePrivatePdf(
  storagePath: string,
  bytes: Uint8Array,
  metadata: Record<string, string> = {},
): Promise<void> {
  await getAdminStorage()
    .bucket()
    .file(storagePath)
    .save(Buffer.from(bytes), {
      resumable: false,
      contentType: "application/pdf",
      metadata: {
        cacheControl: "private, max-age=0, no-store",
        metadata,
      },
    });
}

export function bookingRentalDates(booking: DocumentData): string {
  return `${formatDate(booking.startDate)} - ${formatDate(booking.endDate)} (${booking.dayCount ?? 1} day(s))`;
}

export async function generateAndSaveInvoice(input: {
  booking: DocumentData;
  invoiceNumber: string;
  storagePath: string;
  amountDueNow?: number;
  totalAmount?: number;
  remainingBalance?: number;
  paymentOption?: string;
  isDemo?: boolean;
}): Promise<void> {
  const booking = input.booking;
  const customer = booking.customerSnapshot ?? {};
  const bytes = await createInvoicePdf({
    invoiceNumber: input.invoiceNumber,
    bookingRef: booking.bookingRef,
    customerName: customer.fullName || "Customer",
    customerEmail: customer.email || "",
    productName: booking.productSnapshot?.name || "Rental item",
    rentalDates: bookingRentalDates(booking),
    amount: input.amountDueNow ?? booking.amountDue ?? booking.estimatedRentalAmount ?? 0,
    totalAmount: input.totalAmount ?? booking.estimatedRentalAmount ?? booking.amountDue ?? 0,
    amountDueNow: input.amountDueNow ?? booking.amountDue ?? booking.estimatedRentalAmount ?? 0,
    remainingBalance: input.remainingBalance ?? 0,
    paymentLabel:
      input.paymentOption === "deposit_50"
        ? "50% reservation payment"
        : input.paymentOption === "balance"
          ? "Remaining balance"
          : "Full payment",
    isDemo: input.isDemo === true,
    issuedAt: formatDate(new Date(), true),
  });
  await savePrivatePdf(input.storagePath, bytes, {
    bookingId: booking.id,
    documentType: "invoice",
  });
}

export async function generateAndSaveReceipt(input: {
  booking: DocumentData;
  receiptNumber: string;
  paymentReference: string;
  paymentMethod: string;
  storagePath: string;
  amount?: number;
  isDemo?: boolean;
}): Promise<void> {
  const booking = input.booking;
  const customer = booking.customerSnapshot ?? {};
  const bytes = await createReceiptPdf({
    receiptNumber: input.receiptNumber,
    bookingRef: booking.bookingRef,
    customerName: customer.fullName || "Customer",
    customerEmail: customer.email || "",
    productName: booking.productSnapshot?.name || "Rental item",
    rentalDates: bookingRentalDates(booking),
    amount: input.amount ?? booking.amountDue ?? booking.estimatedRentalAmount ?? 0,
    issuedAt: formatDate(new Date(), true),
    paymentReference: input.paymentReference,
    paymentMethod: input.paymentMethod || "PayMongo",
    isDemo: input.isDemo === true,
  });
  await savePrivatePdf(input.storagePath, bytes, {
    bookingId: booking.id,
    documentType: "receipt",
  });
}

export async function generateAndSaveFinalAgreement(input: {
  booking: DocumentData;
  agreement: DocumentData;
  paymentReference: string;
  storagePath: string;
}): Promise<void> {
  const { booking, agreement } = input;
  const customer = booking.customerSnapshot ?? {};
  const signaturePath = agreement.signature?.storagePath;
  let signatureBytes: Uint8Array | undefined;
  let signatureContentType: string | undefined;

  if (typeof signaturePath === "string" && signaturePath) {
    try {
      const file = getAdminStorage().bucket().file(signaturePath);
      const [bytes, metadata] = await Promise.all([file.download(), file.getMetadata()]);
      signatureBytes = bytes[0];
      signatureContentType = metadata[0].contentType;
    } catch {
      // The typed legal name remains a valid fallback in the final document.
    }
  }

  const bytes = await createFinalAgreementPdf({
    bookingRef: booking.bookingRef,
    customerName: customer.fullName || agreement.signature?.typedFullName || "Customer",
    customerEmail: customer.email || "",
    phone: customer.phone || "",
    address: customer.address || "",
    productName: booking.productSnapshot?.name || "Rental item",
    rentalDates: bookingRentalDates(booking),
    amount: booking.amountPaid ?? booking.amountDue ?? booking.estimatedRentalAmount ?? 0,
    issuedAt: formatDate(new Date(), true),
    fulfillmentMethod: booking.fulfillmentMethod || "",
    customerLocation: booking.customerLocation || "",
    includedAccessories: booking.productSnapshot?.included ?? [],
    termsVersion: agreement.generatedTermsVersion || "2026-01",
    signedAt: formatDate(agreement.signature?.signedAt, true),
    typedFullName: agreement.signature?.typedFullName || customer.fullName || "Customer",
    signatureBytes,
    signatureContentType,
    paymentReference: input.paymentReference,
    confirmedAt: formatDate(new Date(), true),
    isDemo: booking.demoPayment === true,
  });
  await savePrivatePdf(input.storagePath, bytes, {
    bookingId: booking.id,
    documentType: "final_rental_agreement",
  });
}
