"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase/client";
import type { Tables } from "@/src/lib/supabase/database.types";
import type { Admin } from "@/src/types/admin";

function mapAdmin(row: Tables<"admins">): Admin {
  return {
    userId: row.user_id,
    isActive: row.is_active,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Authoritative admin-authorization check, backed by public.admins via the
 * private.is_active_admin() RPC. RLS additionally guarantees a non-admin
 * caller can never observe another user's admins row.
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

export async function getAdminProfile(uid: string): Promise<Admin | null> {
  const { data, error } = await createClient()
    .from("admins")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error || !data) return null;
  return mapAdmin(data);
}

export async function getAllAdmins(): Promise<Admin[]> {
  const { data, error } = await createClient().from("admins").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAdmin);
}
