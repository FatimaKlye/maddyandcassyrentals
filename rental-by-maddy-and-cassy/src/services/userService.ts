import {
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
import type { UserProfile } from "@/src/types/firebase";

const USERS_COLLECTION = "users";

function mapUser(snapshot: QueryDocumentSnapshot<DocumentData>): UserProfile {
  return { id: snapshot.id, ...snapshot.data() } as UserProfile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as UserProfile;
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      "displayName" | "phoneNumber" | "photoURL" | "fullAddress" | "facebookLink" | "instagramLink"
    >
  >
): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION));
  return snapshot.docs.map(mapUser);
}

export async function getUsersByRole(role: UserProfile["role"]): Promise<UserProfile[]> {
  const usersQuery = query(collection(db, USERS_COLLECTION), where("role", "==", role));
  const snapshot = await getDocs(usersQuery);
  return snapshot.docs.map(mapUser);
}

// Requires an authenticated admin caller; Firestore rules reject this write
// from any account whose own role is not already "admin".
export async function setUserRole(uid: string, role: UserProfile["role"]): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCustomerAccountAsAdmin(
  uid: string,
  idToken: string,
): Promise<void> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (response.ok) return;

  let message = "The customer account could not be deleted.";
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") message = body.error;
  } catch {
    // Keep the safe fallback when the server does not return JSON.
  }

  throw new Error(message);
}

export async function updateAccountAsAdmin(
  uid: string,
  idToken: string,
  updates: {
    displayName: string;
    phoneNumber: string;
    fullAddress: string;
    accountStatus: UserProfile["accountStatus"];
    role: UserProfile["role"];
  },
): Promise<void> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  throw new Error(
    typeof body?.error === "string" ? body.error : "The account could not be updated.",
  );
}
