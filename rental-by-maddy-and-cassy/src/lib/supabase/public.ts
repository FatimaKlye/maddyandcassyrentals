import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let publicClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Anonymous-role Supabase client with no cookie/session binding. Safe to use
 * from ISR/static Server Components (unlike src/lib/supabase/server.ts,
 * which calls next/headers cookies() and forces dynamic rendering) and from
 * Client Components rendering guest-visible catalog data. RLS still applies
 * as the `anon` role — never returns anything beyond what
 * `to anon, authenticated` policies expose.
 */
export function createPublicClient() {
  if (publicClient) return publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase public client is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  publicClient = createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return publicClient;
}
