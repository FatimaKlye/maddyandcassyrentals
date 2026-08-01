import {
  collection,
  collectionGroup,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { PaymentEventLog, PaymentRecord } from "@/src/types/payment";

export interface AuditLog {
  id: string;
  action: string;
  actorType: "admin" | "customer" | "system";
  actorId: string;
  bookingId?: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  createdAt: {
    toDate(): Date;
    toMillis(): number;
  };
}

function withId<T>(snapshot: QueryDocumentSnapshot<DocumentData>): T {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

export async function getAllPaymentRecords(): Promise<PaymentRecord[]> {
  const snapshot = await getDocs(collectionGroup(db, "payments"));
  return snapshot.docs.map((item) => withId<PaymentRecord>(item));
}

export async function getPaymentEvents(): Promise<PaymentEventLog[]> {
  const snapshot = await getDocs(collection(db, "paymentEvents"));
  return snapshot.docs.map((item) => withId<PaymentEventLog>(item));
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const snapshot = await getDocs(collection(db, "auditLogs"));
  return snapshot.docs.map((item) => withId<AuditLog>(item));
}
