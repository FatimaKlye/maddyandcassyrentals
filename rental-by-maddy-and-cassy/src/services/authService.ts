import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase/config";

export interface RegisterOptions {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

/**
 * Creates the Firebase Auth account, then creates its matching users/{uid}
 * Firestore doc (accountStatus: "active"). Guests can still browse the
 * whole catalog without an account — this is only called from the sign-up
 * form, which is reached from reservation/account flows that require auth.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName = "",
  options: RegisterOptions = {}
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  await setDoc(doc(db, "users", credential.user.uid), {
    uid: credential.user.uid,
    email,
    displayName,
    firstName: options.firstName ?? "",
    lastName: options.lastName ?? "",
    phoneNumber: options.phoneNumber ?? "",
    role: "customer",
    accountStatus: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return credential.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}
