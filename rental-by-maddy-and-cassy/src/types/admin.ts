import type { Timestamp } from "firebase/firestore";

/**
 * admins/{uid} — authoritative source of truth for admin authorization in
 * both Firestore and Storage security rules (see isActiveAdmin() in
 * firestore.rules / storage.rules). Never written by client code; only the
 * Admin SDK seed script or a trusted server operation may create these.
 */
export interface Admin {
  id: string;
  active: boolean;
  email?: string;
  displayName?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
