"use client";

import type { Subscription, User } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/client";

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
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
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

export function requestEmailOtp(): Promise<EmailOtpDelivery> {
  return emailOtpRequest("/api/auth/email-otp/request");
}

export async function verifyEmailOtp(code: string): Promise<void> {
  await emailOtpRequest<{ verified: boolean }>("/api/auth/email-otp/verify", { code });
  await createClient().auth.refreshSession();
}

/**
 * Creates the Supabase Auth account. The matching public.profiles row is
 * created automatically by the private.handle_new_auth_user() trigger from
 * the metadata passed here — see maddy_cassy_supabase_schema.sql. Guests can
 * still browse the whole catalog without an account; this is only reached
 * from the sign-up form.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName = "",
  options: RegisterOptions = {},
): Promise<User> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || undefined,
        first_name: options.firstName,
        last_name: options.lastName,
        phone_number: options.phoneNumber,
      },
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not create the account.");
  }

  return data.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not sign in.");
  }
  return data.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      typeof window !== "undefined" ? `${window.location.origin}/sign-in` : undefined,
  });
  if (error) throw new Error(error.message);
}

export async function logout(): Promise<void> {
  await createClient().auth.signOut();
}

export function subscribeToAuthChanges(
  callback: (user: User | null) => void,
): () => void {
  const supabase = createClient();
  const {
    data: { subscription },
  }: { data: { subscription: Subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session?.user ?? null);
    },
  );
  return () => subscription.unsubscribe();
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user;
}
