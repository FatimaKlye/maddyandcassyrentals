"use client";

import { createClient } from "@/src/lib/supabase/client";
import type { Tables } from "@/src/lib/supabase/database.types";
import type { UserProfile } from "@/src/types/database";

function mapProfile(row: Tables<"profiles">): UserProfile {
  return {
    id: row.id,
    email: row.contact_email ?? "",
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    displayName: row.display_name,
    phoneNumber: row.phone_number ?? undefined,
    fullAddress: row.full_address ?? undefined,
    facebookLink: row.facebook_url ?? undefined,
    instagramLink: row.instagram_url ?? undefined,
    role: "customer",
    accountStatus: row.account_status as UserProfile["accountStatus"],
    photoPath: row.photo_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfile(data);
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      "displayName" | "phoneNumber" | "fullAddress" | "facebookLink" | "instagramLink"
    >
  >,
): Promise<void> {
  const { error } = await createClient()
    .from("profiles")
    .update({
      display_name: updates.displayName,
      phone_number: updates.phoneNumber,
      full_address: updates.fullAddress,
      facebook_url: updates.facebookLink,
      instagram_url: updates.instagramLink,
    })
    .eq("id", uid);

  if (error) throw new Error(error.message);
}

/** Admin-only: RLS lets an active admin SELECT every profile row, not just their own. */
export async function getAllUsers(): Promise<UserProfile[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProfile);
}

export async function getUsersByRole(role: UserProfile["role"]): Promise<UserProfile[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("*")
    .eq("display_role", role);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProfile);
}

async function callAdminUserRoute<T>(
  uid: string,
  init: RequestInit,
): Promise<T | void> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    credentials: "same-origin",
    ...init,
  });

  if (response.ok) {
    return response.status === 204 ? undefined : ((await response.json()) as T);
  }

  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  throw new Error(
    typeof body?.error === "string" ? body.error : "The request could not be completed.",
  );
}

export async function deleteCustomerAccountAsAdmin(uid: string): Promise<void> {
  await callAdminUserRoute(uid, { method: "DELETE" });
}

export async function updateAccountAsAdmin(
  uid: string,
  updates: {
    displayName: string;
    phoneNumber: string;
    fullAddress: string;
    accountStatus: UserProfile["accountStatus"];
    role: UserProfile["role"];
  },
): Promise<void> {
  await callAdminUserRoute(uid, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}
