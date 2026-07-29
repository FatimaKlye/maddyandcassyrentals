import {
  collection,
  getDocs,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type {
  BookingInvoice,
  BookingReceipt,
  PaymentOption,
  PaymentRecord,
} from "@/src/types/payment";
import { getAppCheckHeaders } from "@/src/lib/firebase/appCheckClient";

function withId<T>(snapshot: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

export async function createPaymentCheckout(
  bookingId: string,
  idToken: string,
  paymentOption: PaymentOption = "full",
  returnPath?: string,
): Promise<{ checkoutUrl: string }> {
  const response = await fetch("/api/payments/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      ...(await getAppCheckHeaders()),
    },
    body: JSON.stringify({ bookingId, paymentOption, returnPath }),
  });

  const body = (await response.json().catch(() => null)) as
    | { checkoutUrl?: unknown; error?: unknown }
    | null;
  if (!response.ok || typeof body?.checkoutUrl !== "string") {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "The secure payment checkout could not be opened.",
    );
  }
  return { checkoutUrl: body.checkoutUrl };
}

export async function getBookingPayments(
  bookingId: string,
): Promise<PaymentRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "bookings", bookingId, "payments"),
      orderBy("createdAt", "desc"),
    ),
  );
  return snapshot.docs.map((item) => withId<PaymentRecord>(item));
}

export async function getBookingInvoices(
  bookingId: string,
): Promise<BookingInvoice[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "bookings", bookingId, "invoices"),
      orderBy("issuedAt", "desc"),
    ),
  );
  return snapshot.docs.map((item) => withId<BookingInvoice>(item));
}

export async function getBookingReceipts(
  bookingId: string,
): Promise<BookingReceipt[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "bookings", bookingId, "receipts"),
      orderBy("issuedAt", "desc"),
    ),
  );
  return snapshot.docs.map((item) => withId<BookingReceipt>(item));
}
