import { doc, getDoc, getDocs, collection, updateDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/src/lib/firebase/config";
import type { Booking, RequirementsDoc, AgreementDoc, StatusHistoryEntry, BookingDocument } from "@/src/types/booking";

export interface BookingDetails {
  booking: Booking;
  requirements: RequirementsDoc | null;
  agreement: AgreementDoc | null;
  statusHistory: StatusHistoryEntry[];
  documents: BookingDocument[];
}

export async function getBookingDetails(bookingId: string): Promise<BookingDetails | null> {
  const bookingSnapshot = await getDoc(doc(db, "bookings", bookingId));
  if (!bookingSnapshot.exists()) return null;

  const [requirementsSnapshot, agreementSnapshot, statusHistorySnapshot, documentsSnapshot] =
    await Promise.all([
      getDoc(doc(db, "bookings", bookingId, "requirements", "main")),
      getDoc(doc(db, "bookings", bookingId, "agreement", "main")),
      getDocs(query(collection(db, "bookings", bookingId, "statusHistory"), orderBy("changedAt", "asc"))),
      getDocs(collection(db, "bookings", bookingId, "documents")),
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
  };
}

/**
 * Resubmits a booking after the customer has addressed a correction request.
 * Only valid while the booking's status is "correction_required" — enforced
 * by firestore.rules, which also pins every other field to its prior value.
 */
export async function resubmitBooking(bookingId: string): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    status: "submitted",
    updatedAt: serverTimestamp(),
  });
}

type RequirementFileField =
  | "idOneStoragePath"
  | "idTwoStoragePath"
  | "selfieWithIdStoragePath";

export async function replaceRequirementFile(
  userId: string,
  bookingId: string,
  field: RequirementFileField,
  file: File
): Promise<void> {
  const extension = file.name.split(".").pop() ?? "jpg";
  const path = `private/users/${userId}/bookings/${bookingId}/requirements/${field}-${Date.now()}.${extension}`;
  await uploadBytes(ref(storage, path), file);

  await updateDoc(doc(db, "bookings", bookingId, "requirements", "main"), {
    [field]: path,
    updatedAt: serverTimestamp(),
  });
}
