"use client";

import type { Subscription, User } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/client";

export interface SendEmailOtpOptions {
  /** Creates a new account for this email if one does not already exist. */
  shouldCreateUser?: boolean;
  /** Optional redirect target for confirmation links / OTP emails. */
  emailRedirectTo?: string;
}

/**
 * Sends a 6-digit one-time code to the given email via Supabase's native
 * email OTP delivery. Used for both customer sign-in (existing accounts
 * only) and sign-up (creates the account on first verified code) — see
 * app/(auth)/sign-in and app/(auth)/sign-up.
 */
export async function sendEmailOtp(
  email: string,
  options: SendEmailOtpOptions = {},
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: options.shouldCreateUser ?? false,
      emailRedirectTo: options.emailRedirectTo,
    },
  });
  if (error) {
    const normalized = error.message.toLowerCase();
    if (!options.shouldCreateUser && normalized.includes("signups not allowed for otp")) {
      throw new Error(
        "No customer account was found for that email. Please create an account first.",
      );
    }
    throw new Error(error.message);
  }
}

export async function verifyEmailOtp(email: string, token: string): Promise<User> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    throw new Error(error?.message ?? "The verification code could not be confirmed.");
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
