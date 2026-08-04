import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/lib/supabase/database.types";
import type { CatalogEditorInput } from "@/src/services/productService";

export function parseCatalogInput(value: unknown): CatalogEditorInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  const input = value as Record<string, unknown>;
  const string = (key: string, max: number, required = true) => {
    const result = typeof input[key] === "string" ? (input[key] as string).trim() : "";
    if (required && (!result || result.length > max)) throw new Error("INVALID_CATALOG_INPUT");
    return result.slice(0, max);
  };
  const dailyRate = Number(input.dailyRate);
  const refundableDeposit = Number(input.refundableDeposit ?? 0);
  const totalUnits = Number(input.totalUnits);
  if (!Number.isFinite(dailyRate) || dailyRate <= 0 || dailyRate > 1_000_000) {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  if (!Number.isFinite(refundableDeposit) || refundableDeposit < 0) {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  if (!Number.isInteger(totalUnits) || totalUnits < 0 || totalUnits > 1000) {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  const status = input.status;
  if (status !== "draft" && status !== "active" && status !== "inactive" && status !== "archived") {
    throw new Error("INVALID_CATALOG_INPUT");
  }
  const specifications =
    typeof input.specifications === "object" && input.specifications !== null && !Array.isArray(input.specifications)
      ? (input.specifications as Record<string, string>)
      : {};

  return {
    name: string("name", 150),
    brand: string("brand", 100, false),
    category: string("category", 100),
    shortDescription: string("shortDescription", 300, false),
    description: string("description", 3000, false),
    dailyRate,
    refundableDeposit,
    specifications,
    totalUnits,
    isFeatured: input.isFeatured === true,
    status,
  };
}

function slugify(value: string, fallback: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
  return `${base || fallback}-${Date.now().toString(36)}`;
}

/**
 * products.brand_id is a FK to public.brands, not a free-text column — the
 * catalog editor still collects a brand name string, so it's looked up (or
 * created on first use) by name. An empty brand name is allowed (brand_id is
 * nullable).
 */
export async function resolveBrandId(
  admin: SupabaseClient<Database>,
  brandName: string,
): Promise<string | null> {
  const trimmed = brandName.trim();
  if (!trimmed) return null;

  const { data: existing } = await admin.from("brands").select("id").ilike("name", trimmed).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("brands")
    .insert({ name: trimmed, slug: slugify(trimmed, "brand") })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "The brand could not be created.");
  return created.id;
}

/**
 * products.category_id is a required FK to public.categories, not a
 * free-text column — same lookup-or-create pattern as resolveBrandId(), but
 * a category name is mandatory (parseCatalogInput() already enforces that).
 */
export async function resolveCategoryId(
  admin: SupabaseClient<Database>,
  categoryName: string,
): Promise<string> {
  const trimmed = categoryName.trim();
  if (!trimmed) throw new Error("INVALID_CATALOG_INPUT");

  const { data: existing } = await admin.from("categories").select("id").ilike("name", trimmed).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("categories")
    .insert({ name: trimmed, slug: slugify(trimmed, "category") })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "The category could not be created.");
  return created.id;
}

/**
 * Adds/removes public.inventory_units rows so the physical unit count
 * matches totalUnits — the closest Postgres equivalent of the old Firestore
 * inventoryUnits reconciliation. Units beyond the new count are marked
 * 'retired' rather than deleted, to preserve any historical booking
 * references (unit_reservations.inventory_unit_id references inventory_units).
 */
export async function reconcileInventoryUnits(
  admin: SupabaseClient<Database>,
  productId: string,
  totalUnits: number,
): Promise<void> {
  const { data: units } = await admin
    .from("inventory_units")
    .select("id, unit_code, lifecycle_status")
    .eq("product_id", productId)
    .order("unit_code", { ascending: true });

  const existing = units ?? [];

  if (existing.length < totalUnits) {
    const newRows = Array.from({ length: totalUnits - existing.length }, (_, index) => ({
      product_id: productId,
      unit_code: `UNIT-${(existing.length + index + 1).toString().padStart(3, "0")}`,
      lifecycle_status: "active" as const,
    }));
    await admin.from("inventory_units").insert(newRows);
  }

  for (const [index, unit] of existing.entries()) {
    const shouldBeActive = index < totalUnits;
    const nextStatus = shouldBeActive
      ? unit.lifecycle_status === "retired"
        ? "active"
        : unit.lifecycle_status
      : "retired";
    if (nextStatus !== unit.lifecycle_status) {
      await admin.from("inventory_units").update({ lifecycle_status: nextStatus }).eq("id", unit.id);
    }
  }
}
