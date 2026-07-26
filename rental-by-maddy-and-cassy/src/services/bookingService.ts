import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { Booking, BookingStatus } from "@/src/types/firebase";

const BOOKINGS_COLLECTION = "bookings";

function mapBooking(snapshot: QueryDocumentSnapshot<DocumentData>): Booking {
  return { id: snapshot.id, ...snapshot.data() } as Booking;
}

export async function createBooking(
  booking: Omit<Booking, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: BookingStatus;
  }
): Promise<string> {
  const docRef = await addDoc(collection(db, BOOKINGS_COLLECTION), {
    ...booking,
    status: booking.status ?? "submitted",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  const snapshot = await getDoc(doc(db, BOOKINGS_COLLECTION, bookingId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Booking;
}

export async function getBookingsForUser(userId: string): Promise<Booking[]> {
  const bookingsQuery = query(
    collection(db, BOOKINGS_COLLECTION),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(bookingsQuery);
  return snapshot.docs.map(mapBooking);
}

export async function getAllBookings(): Promise<Booking[]> {
  const snapshot = await getDocs(collection(db, BOOKINGS_COLLECTION));
  return snapshot.docs.map(mapBooking);
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<void> {
  await updateDoc(doc(db, BOOKINGS_COLLECTION, bookingId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await updateBookingStatus(bookingId, "cancelled");
}
