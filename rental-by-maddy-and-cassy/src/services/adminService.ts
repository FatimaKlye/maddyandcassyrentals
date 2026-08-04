"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/client";
import type { Database } from "@/src/lib/supabase/database.types";
import type { Admin } from "@/src/types/admin";

/**
 * Authoritative admin-authorization check, backed by public.user_roles /
 * public.profiles via the private.is_active_admin() -> private.is_admin()
 * RPC chain. RLS additionally guarantees a non-admin caller can never
 * observe another user's user_roles row.
 */
export async function isActiveAdmin(): Promise<boolean> {
  const { data, error } = await createClient().rpc("is_active_admin");
  return !error && data === true;
}

/** Kept for call-site compatibility with code that already has a User in hand. */
export async function checkActiveAdmin(user: User): Promise<boolean> {
  void user;
  return isActiveAdmin();
}

/**
 * There is no more public.admins table — a user is an admin iff they have a
 * public.user_roles row with role = 'admin', and "active" mirrors
 * private.is_admin()'s exact check: the matching profiles row must have
 * account_status = 'active'. user_roles has no FK declared toward profiles
 * (its user_id references auth.users), so the two are fetched separately.
 */
async function mapAdminRows(
  supabase: SupabaseClient<Database>,
  roleRows: { user_id: string; created_by: string | null; created_at: string }[],
): Promise<Admin[]> {
  if (!roleRows.length) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, account_status")
    .in(
      "id",
      roleRows.map((row) => row.user_id),
    );
  const activeIds = new Set(
    (profiles ?? []).filter((profile) => profile.account_status === "active").map((profile) => profile.id),
  );

  return roleRows.map((row) => ({
    userId: row.user_id,
    isActive: activeIds.has(row.user_id),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function getAdminProfile(uid: string): Promise<Admin | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, created_by, created_at")
    .eq("user_id", uid)
    .eq("role", "admin")
    .maybeSingle();

  if (error || !data) return null;
  const [admin] = await mapAdminRows(supabase, [data]);
  return admin ?? null;
}

export async function getAllAdmins(): Promise<Admin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, created_by, created_at")
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return mapAdminRows(supabase, data ?? []);
}
