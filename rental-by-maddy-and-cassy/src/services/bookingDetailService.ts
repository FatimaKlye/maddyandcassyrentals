import {
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/src/lib/firebase/config";
import type { Booking, RequirementsDoc, AgreementDoc, StatusHistoryEntry, BookingDocument } from "@/src/types/booking";
import type { BookingInvoice, BookingReceipt, PaymentRecord } from "@/src/types/payment";

export interface BookingDetails {
  booking: Booking;
  requirements: RequirementsDoc | null;
  agreement: AgreementDoc | null;
  statusHistory: StatusHistoryEntry[];
  documents: BookingDocument[];
  payments: PaymentRecord[];
  invoices: BookingInvoice[];
  receipts: BookingReceipt[];
}

export async function getBookingDetails(bookingId: string): Promise<BookingDetails | null> {
  const bookingSnapshot = await getDoc(doc(db, "bookings", bookingId));
  if (!bookingSnapshot.exists()) return null;

  const [
    requirementsSnapshot,
    agreementSnapshot,
    statusHistorySnapshot,
    documentsSnapshot,
    paymentsSnapshot,
    invoicesSnapshot,
    receiptsSnapshot,
  ] =
    await Promise.all([
      getDoc(doc(db, "bookings", bookingId, "requirements", "main")),
      getDoc(doc(db, "bookings", bookingId, "agreement", "main")),
      getDocs(query(collection(db, "bookings", bookingId, "statusHistory"), orderBy("createdAt", "asc"))),
      getDocs(collection(db, "bookings", bookingId, "documents")),
      getDocs(collection(db, "bookings", bookingId, "payments")),
      getDocs(collection(db, "bookings", bookingId, "invoices")),
      getDocs(collection(db, "bookings", bookingId, "receipts")),
    ]);

  return {
    booking: { id: bookingSnapshot.id, ...bookingSnapshot.data() } as Booking,
    requirements: requirementsSnapshot.exists()
      ? ({ ...requirementsSnapshot.data() } as RequirementsDoc)
      : null,
    agreement: agreementSnapshot.exists() ? ({ ...agreementSnapshot.data() } as AgreementDoc) : null,
    statusHistory: statusHistorySnapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as StatusHistoryEntry[],
    documents: documentsSnapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as BookingDocument[],
    payments: paymentsSnapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as PaymentRecord[],
    invoices: invoicesSnapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as BookingInvoice[],
    receipts: receiptsSnapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    })) as BookingReceipt[],
  };
}

export async function getBookingFileUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

/**
 * Resubmits a booking after the customer has addressed a correction request.
 * Only valid while the booking's status is "correction_required" — enforced
 * by firestore.rules, which also pins every other field to its prior value.
 */
type RequirementFileField =
  | "idOneStoragePath"
  | "idTwoStoragePath"
  | "selfieWithIdStoragePath"
  | "emergencyContactIdStoragePath";

export async function resubmitBookingCorrections(
  userId: string,
  bookingId: string,
  replacementFiles: Partial<Record<RequirementFileField, File>>,
): Promise<void> {
  const requirementUpdates: Record<string, unknown> = {
    status: "submitted",
    updatedAt: serverTimestamp(),
  };

  for (const [field, file] of Object.entries(replacementFiles)) {
    if (!file) continue;
    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `private/users/${userId}/bookings/${bookingId}/requirements/${field}-${Date.now()}.${extension}`;
    await uploadBytes(ref(storage, path), file);
    requirementUpdates[
      field === "emergencyContactIdStoragePath"
        ? "emergencyContact.idStoragePath"
        : field
    ] = path;
  }

  const bookingRef = doc(db, "bookings", bookingId);
  const requirementsRef = doc(db, "bookings", bookingId, "requirements", "main");
  const agreementRef = doc(db, "bookings", bookingId, "agreement", "main");
  const agreementSnapshot = await getDoc(agreementRef);
  const batch = writeBatch(db);

  batch.update(requirementsRef, requirementUpdates);
  if (agreementSnapshot.exists()) {
    batch.update(agreementRef, {
      status: "submitted_for_review",
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(bookingRef, {
    status: "submitted",
    updatedAt: serverTimestamp(),
    resubmittedAt: serverTimestamp(),
  });

  await batch.commit();
}
