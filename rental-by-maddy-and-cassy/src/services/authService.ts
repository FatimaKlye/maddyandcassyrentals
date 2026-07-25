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

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });

  await setDoc(doc(db, "users", credential.user.uid), {
    uid: credential.user.uid,
    email,
    displayName,
    role: "customer",
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
