import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase/config";
import { getAppCheckHeaders } from "@/src/lib/firebase/appCheckClient";

export interface RegisterOptions {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface EmailOtpDelivery {
  alreadyVerified?: boolean;
  delivery?: "email" | "preview";
  maskedEmail?: string;
  demoCode?: string;
}

async function emailOtpRequest<T>(
  path: "/api/auth/email-otp/request" | "/api/auth/email-otp/verify",
  user: User,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(await getAppCheckHeaders()),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json().catch(() => null)) as
    | (T & { error?: unknown })
    | null;
  if (!response.ok) {
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "Email verification could not be completed.",
    );
  }
  if (!result) throw new Error("Email verification could not be completed.");
  return result;
}

export function requestEmailOtp(user: User): Promise<EmailOtpDelivery> {
  return emailOtpRequest("/api/auth/email-otp/request", user);
}

export async function verifyEmailOtp(user: User, code: string): Promise<void> {
  await emailOtpRequest<{ verified: boolean }>(
    "/api/auth/email-otp/verify",
    user,
    { code },
  );
  await reload(user);
  await user.getIdToken(true);
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
