import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createFinalAgreementPdf,
  createInvoicePdf,
  createReceiptPdf,
} from "../src/lib/pdf/customerDocuments";

const outputDirectory = resolve("output", "pdf");
async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const base = {
    bookingRef: "MC-20260729-DEMO",
    customerName: "Sample Customer",
    customerEmail: "customer@example.com",
    productName: "Fujifilm Instax Mini 12",
    rentalDates: "July 29, 2026 - July 30, 2026 (2 days)",
    amount: 1250,
    issuedAt: "July 29, 2026, 3:30 PM",
  };

  await Promise.all([
  writeFile(
    resolve(outputDirectory, "sample-booking-invoice.pdf"),
    await createInvoicePdf({
      ...base,
      invoiceNumber: "INV-MC-20260729-DEMO",
      totalAmount: 2500,
      amountDueNow: 1250,
      remainingBalance: 1250,
      paymentLabel: "50% reservation payment",
    }),
  ),
  writeFile(
    resolve(outputDirectory, "sample-payment-receipt.pdf"),
    await createReceiptPdf({
      ...base,
      receiptNumber: "OR-MC-20260729-DEMO",
      paymentReference: "pay_demo_verified",
      paymentMethod: "GCash",
    }),
  ),
  writeFile(
    resolve(outputDirectory, "sample-signed-rental-agreement.pdf"),
    await createFinalAgreementPdf({
      ...base,
      address: "Sta. Cruz, Manila",
      phone: "+63 917 000 0000",
      fulfillmentMethod: "Pickup",
      customerLocation: "Sta. Cruz, Manila",
      includedAccessories: ["Protective case", "Wrist strap", "USB charging cable"],
      termsVersion: "2026-01",
      signedAt: "July 29, 2026, 3:35 PM",
      typedFullName: "Sample Customer",
      paymentReference: "pay_demo_verified",
      confirmedAt: "July 29, 2026, 3:31 PM",
    }),
  ),
  ]);

  console.log(outputDirectory);
}

void main();
