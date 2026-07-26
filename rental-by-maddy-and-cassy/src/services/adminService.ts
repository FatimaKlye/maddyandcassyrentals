import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";

/**
 * Reads admins/{uid} — the single source of truth for admin authorization
 * (mirrored by isActiveAdmin() in firestore.rules / storage.rules). There is
 * no admin dashboard in this codebase yet; this exists so future
 * admin-only routes/components have a ready way to check access.
 */
export async function isActiveAdmin(uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, "admins", uid));
  return snapshot.exists() && snapshot.data().active === true;
}
