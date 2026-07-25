import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { Payment, PaymentStatus } from "@/src/types/firebase";

const PAYMENTS_COLLECTION = "payments";

function mapPayment(snapshot: QueryDocumentSnapshot<DocumentData>): Payment {
  return { id: snapshot.id, ...snapshot.data() } as Payment;
}

export async function createPayment(
  payment: Omit<Payment, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: PaymentStatus;
  }
): Promise<string> {
  const docRef = await addDoc(collection(db, PAYMENTS_COLLECTION), {
    ...payment,
    status: payment.status ?? "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getPaymentById(paymentId: string): Promise<Payment | null> {
  const snapshot = await getDoc(doc(db, PAYMENTS_COLLECTION, paymentId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Payment;
}

export async function getPaymentsForUser(userId: string): Promise<Payment[]> {
  const paymentsQuery = query(
    collection(db, PAYMENTS_COLLECTION),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(paymentsQuery);
  return snapshot.docs.map(mapPayment);
}

export async function getAllPayments(): Promise<Payment[]> {
  const snapshot = await getDocs(collection(db, PAYMENTS_COLLECTION));
  return snapshot.docs.map(mapPayment);
}

export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus
): Promise<void> {
  await updateDoc(doc(db, PAYMENTS_COLLECTION, paymentId), {
    status,
    updatedAt: serverTimestamp(),
  });
}
