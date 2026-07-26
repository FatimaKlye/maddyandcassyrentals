import {
  collection,
  doc,
  getDoc,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { Admin } from "@/src/types/admin";

const ADMINS_COLLECTION = "admins";

function mapAdmin(snapshot: QueryDocumentSnapshot<DocumentData>): Admin {
  return { id: snapshot.id, ...snapshot.data() } as Admin;
}

/**
 * Reads admins/{uid} — the single source of truth for admin authorization
 * (mirrored by isActiveAdmin() in firestore.rules / storage.rules). There is
 * no admin dashboard in this codebase yet; this exists so future
 * admin-only routes/components have a ready way to check access.
 */
export async function isActiveAdmin(uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, ADMINS_COLLECTION, uid));
  return snapshot.exists() && snapshot.data().active === true;
}

export async function getAdminProfile(uid: string): Promise<Admin | null> {
  const snapshot = await getDoc(doc(db, ADMINS_COLLECTION, uid));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Admin;
}

export async function getAllAdmins(): Promise<Admin[]> {
  const snapshot = await getDocs(collection(db, ADMINS_COLLECTION));
  return snapshot.docs.map(mapAdmin);
}
