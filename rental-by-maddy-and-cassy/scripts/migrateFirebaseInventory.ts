/**
 * One-time backfill: Firestore `inventory` + `inventoryUnits` -> Supabase
 * `inventory_units` (authoritative). The 2026-08-04 schema normalization
 * dropped both `products.firebase_id` and `inventory_units.firebase_id`, so
 * this script can no longer look up the destination product by a stored
 * Firebase id, and can no longer upsert on a firebase_id conflict target —
 * units are now deduped by (product_id, unit_code) instead. It also dropped
 * the materialized `product_availability_summary` table (see
 * private.refresh_product_availability(), which still references it but is
 * only wired to the legacy schema's trigger, not the current one) — the
 * post-import validation step below counts public.inventory_units directly
 * instead.
 *
 * Usage:
 *   npx tsx scripts/migrateFirebaseInventory.ts \
 *     --inventory=data/firebase-export/inventory.json \
 *     --units=data/firebase-export/inventoryUnits.json \
 *     --product-map=data/firebase-export/product-map.json \
 *     [--dry-run]
 *
 * Expected JSON shape for each export file (either form accepted):
 *   { "<firestoreDocId>": { ...fields }, ... }          // object map
 *   [ { "id": "<firestoreDocId>", ...fields }, ... ]     // array
 *
 * --product-map is required and must be a flat object mapping the Firestore
 * product doc id to the destination public.products.id (uuid):
 *   { "<firestoreProductId>": "<supabase-product-uuid>", ... }
 *
 * inventory doc fields:       availableUnits, totalUnits, updatedAt,
 *                             bookedDateCounts: { rentedUnits, reservedUnits }
 * inventoryUnits doc fields:  productId, unitCode, serialNumber, status,
 *                             conditionNotes, acquiredAt, createdAt, updatedAt
 *
 * Timestamps may be an ISO string, epoch millis/seconds, or a Firestore
 * Timestamp-shaped object ({ seconds, nanoseconds } / { _seconds, _nanoseconds }).
 */
import { readFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";

const ALLOWED_STATUSES = new Set(["available", "reserved", "rented", "maintenance", "inactive"]);

/** Old Firestore inventory-unit statuses collapse onto the new 3-value lifecycle enum. */
function toLifecycleStatus(status: string): "active" | "maintenance" | "retired" {
  if (status === "maintenance") return "maintenance";
  if (status === "inactive") return "retired";
  return "active"; // available / reserved / rented all mean "the physical unit exists and is usable"
}

interface FirebaseInventoryDoc {
  availableUnits?: number;
  totalUnits?: number;
  updatedAt?: unknown;
  bookedDateCounts?: { rentedUnits?: number; reservedUnits?: number };
}

interface FirebaseInventoryUnitDoc {
  productId?: string;
  unitCode?: string;
  serialNumber?: string;
  status?: string;
  conditionNotes?: string;
  acquiredAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function parseArgs() {
  const args = new Map<string, string>();
  for (const raw of process.argv.slice(2)) {
    if (raw === "--dry-run") {
      args.set("dry-run", "true");
      continue;
    }
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    args.set(key, rest.join("="));
  }
  const productMapPath = args.get("product-map");
  if (!productMapPath) {
    throw new Error(
      "--product-map=<file> is required: products.firebase_id no longer exists, so the Firestore " +
        "product id -> Supabase product uuid mapping must be supplied explicitly.",
    );
  }
  return {
    inventoryPath: args.get("inventory") ?? "data/firebase-export/inventory.json",
    unitsPath: args.get("units") ?? "data/firebase-export/inventoryUnits.json",
    productMapPath,
    dryRun: args.get("dry-run") === "true",
  };
}

/** Normalizes either `{id: fields}` or `[{id, ...fields}]` export shapes into `[id, fields][]`. */
function loadDocs<T>(path: string): Array<[string, T]> {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(raw)) {
    return raw.map((doc) => {
      const { id, ...fields } = doc as { id: string } & T;
      return [id, fields as T];
    });
  }
  return Object.entries(raw as Record<string, T>);
}

function loadProductMap(path: string): Map<string, string> {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  return new Map(Object.entries(raw));
}

/** Accepts ISO strings, epoch numbers, or Firestore Timestamp-shaped objects; returns an ISO string or null. */
function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const seconds = (obj.seconds ?? obj._seconds) as number | undefined;
    if (typeof seconds === "number") return new Date(seconds * 1000).toISOString();
  }
  return null;
}

function toDateOnly(value: unknown): string | null {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

async function main() {
  const { inventoryPath, unitsPath, productMapPath, dryRun } = parseArgs();
  const supabase = createAdminClient();

  console.log(
    `Loading ${unitsPath}, ${inventoryPath}, and ${productMapPath}${dryRun ? " (dry run)" : ""}...`,
  );
  const unitDocs = loadDocs<FirebaseInventoryUnitDoc>(unitsPath);
  const inventoryDocs = loadDocs<FirebaseInventoryDoc>(inventoryPath);
  const productIdByFirebaseId = loadProductMap(productMapPath);

  const { data: existingUnits, error: existingUnitsError } = await supabase
    .from("inventory_units")
    .select("product_id, unit_code");
  if (existingUnitsError) throw existingUnitsError;
  const existingKeys = new Set((existingUnits ?? []).map((u) => `${u.product_id}:${u.unit_code}`));

  // ---- Transform + insert new inventory_units (deduped by product_id + unit_code) ----
  const skippedUnits: Array<{ firebaseId: string; reason: string }> = [];
  const seenKeys = new Set<string>();
  const rows: Array<{
    product_id: string;
    unit_code: string;
    serial_number: string | null;
    lifecycle_status: "active" | "maintenance" | "retired";
    condition_notes: string | null;
    acquired_at: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  for (const [firebaseId, doc] of unitDocs) {
    const productId = doc.productId ? productIdByFirebaseId.get(doc.productId) : undefined;
    if (!productId) {
      skippedUnits.push({ firebaseId, reason: `no product mapping for productId "${doc.productId}"` });
      continue;
    }
    if (!doc.status || !ALLOWED_STATUSES.has(doc.status)) {
      skippedUnits.push({ firebaseId, reason: `invalid status "${doc.status}"` });
      continue;
    }
    if (!doc.unitCode) {
      skippedUnits.push({ firebaseId, reason: "missing unitCode" });
      continue;
    }

    const key = `${productId}:${doc.unitCode}`;
    if (existingKeys.has(key) || seenKeys.has(key)) {
      skippedUnits.push({ firebaseId, reason: `duplicate unit_code "${doc.unitCode}" for this product` });
      continue;
    }
    seenKeys.add(key);

    const createdAt = toIso(doc.createdAt) ?? new Date().toISOString();
    const updatedAt = toIso(doc.updatedAt) ?? createdAt;

    rows.push({
      product_id: productId,
      unit_code: doc.unitCode,
      serial_number: doc.serialNumber ?? null,
      lifecycle_status: toLifecycleStatus(doc.status),
      condition_notes: doc.conditionNotes ?? null,
      acquired_at: toDateOnly(doc.acquiredAt),
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  console.log(`Prepared ${rows.length} inventory_units rows (${skippedUnits.length} skipped).`);
  if (skippedUnits.length) {
    console.log("Skipped units:");
    for (const s of skippedUnits) console.log(`  - ${s.firebaseId}: ${s.reason}`);
  }

  if (!dryRun && rows.length) {
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from("inventory_units").insert(chunk);
      if (error) throw error;
      console.log(`Inserted rows ${i + 1}-${i + chunk.length} of ${rows.length}.`);
    }
  } else if (dryRun) {
    console.log("Dry run: skipping insert.");
  }

  // ---- Validate against Firestore-reported inventory totals ----
  // There is no more product_availability_summary table to read back — the
  // new schema computes availability live via get_product_availability(), so
  // this validation instead re-queries inventory_units directly and compares
  // active-unit counts. Firestore's reserved/rented breakdown has no
  // equivalent post-import (that requires date-scoped unit_reservations data,
  // which this backfill does not create), so only totalUnits is checked.
  const { data: allUnits, error: allUnitsError } = await supabase
    .from("inventory_units")
    .select("product_id, lifecycle_status");
  if (allUnitsError) throw allUnitsError;

  const activeCountByProductId = new Map<string, number>();
  for (const unit of allUnits ?? []) {
    if (unit.lifecycle_status === "retired") continue;
    activeCountByProductId.set(unit.product_id, (activeCountByProductId.get(unit.product_id) ?? 0) + 1);
  }

  const mismatches: string[] = [];
  const notFound: string[] = [];

  for (const [firebaseId, doc] of inventoryDocs) {
    const productId = productIdByFirebaseId.get(firebaseId);
    if (!productId) {
      notFound.push(firebaseId);
      continue;
    }
    const actualTotal = activeCountByProductId.get(productId) ?? 0;
    const expectedTotal = doc.totalUnits ?? 0;
    if (actualTotal !== expectedTotal) {
      mismatches.push(`${firebaseId} (totalUnits): Firebase=${expectedTotal} vs imported=${actualTotal}`);
    }
  }

  console.log(`\nValidation against ${inventoryDocs.length} Firebase inventory docs:`);
  console.log(`  ${notFound.length} inventory doc(s) had no matching product mapping.`);
  if (notFound.length) console.log(`    ${notFound.join(", ")}`);
  console.log(`  ${mismatches.length} field mismatch(es).`);
  for (const m of mismatches) console.log(`    - ${m}`);
  if (!mismatches.length && !notFound.length) console.log("  All totals reconcile.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
