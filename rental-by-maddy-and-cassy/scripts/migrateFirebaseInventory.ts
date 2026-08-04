/**
 * One-time backfill: Firestore `inventory` + `inventoryUnits` -> Supabase
 * `inventory_units` (authoritative). `product_availability_summary` is never
 * written directly here — inserting into inventory_units fires
 * private.inventory_availability_trigger(), which recalculates it. The
 * Firestore `inventory` collection is used only as a validation source: after
 * import, its totals are diffed against the trigger-recalculated summary and
 * any mismatch is reported.
 *
 * Usage:
 *   npx tsx scripts/migrateFirebaseInventory.ts \
 *     --inventory=data/firebase-export/inventory.json \
 *     --units=data/firebase-export/inventoryUnits.json \
 *     [--dry-run]
 *
 * Expected JSON shape for each export file (either form accepted):
 *   { "<firestoreDocId>": { ...fields }, ... }          // object map
 *   [ { "id": "<firestoreDocId>", ...fields }, ... ]     // array
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
  return {
    inventoryPath: args.get("inventory") ?? "data/firebase-export/inventory.json",
    unitsPath: args.get("units") ?? "data/firebase-export/inventoryUnits.json",
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
  const { inventoryPath, unitsPath, dryRun } = parseArgs();
  const supabase = createAdminClient();

  console.log(`Loading ${unitsPath} and ${inventoryPath}${dryRun ? " (dry run)" : ""}...`);
  const unitDocs = loadDocs<FirebaseInventoryUnitDoc>(unitsPath);
  const inventoryDocs = loadDocs<FirebaseInventoryDoc>(inventoryPath);

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, firebase_id");
  if (productsError) throw productsError;

  const productIdByFirebaseId = new Map<string, string>();
  for (const p of products ?? []) {
    if (p.firebase_id) productIdByFirebaseId.set(p.firebase_id, p.id);
  }

  // ---- Transform + upsert inventory_units ----
  const skippedUnits: Array<{ firebaseId: string; reason: string }> = [];
  const rows: Array<{
    firebase_id: string;
    product_id: string;
    unit_code: string;
    serial_number: string | null;
    status: string;
    condition_notes: string | null;
    acquired_at: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  for (const [firebaseId, doc] of unitDocs) {
    const productId = doc.productId ? productIdByFirebaseId.get(doc.productId) : undefined;
    if (!productId) {
      skippedUnits.push({ firebaseId, reason: `no product found for productId "${doc.productId}"` });
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

    const createdAt = toIso(doc.createdAt) ?? new Date().toISOString();
    const updatedAt = toIso(doc.updatedAt) ?? createdAt;

    rows.push({
      firebase_id: firebaseId,
      product_id: productId,
      unit_code: doc.unitCode,
      serial_number: doc.serialNumber ?? null,
      status: doc.status,
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
      const { error } = await supabase
        .from("inventory_units")
        .upsert(chunk, { onConflict: "firebase_id" });
      if (error) throw error;
      console.log(`Upserted rows ${i + 1}-${i + chunk.length} of ${rows.length}.`);
    }
  } else if (dryRun) {
    console.log("Dry run: skipping upsert.");
  }

  // ---- Validate against Firestore-reported inventory totals ----
  // product_availability_summary is never written here; it was already
  // recalculated by private.inventory_availability_trigger() as a side
  // effect of the upsert above (AFTER INSERT/UPDATE on inventory_units).
  const { data: summaries, error: summaryError } = await supabase
    .from("product_availability_summary")
    .select("product_id, total_units, available_units, reserved_units, rented_units, maintenance_units");
  if (summaryError) throw summaryError;

  const summaryByProductId = new Map((summaries ?? []).map((s) => [s.product_id, s]));
  const mismatches: string[] = [];
  const notFound: string[] = [];

  for (const [firebaseId, doc] of inventoryDocs) {
    const productId = productIdByFirebaseId.get(firebaseId);
    if (!productId) {
      notFound.push(firebaseId);
      continue;
    }
    const summary = summaryByProductId.get(productId);
    if (!summary) {
      mismatches.push(`${firebaseId}: no product_availability_summary row (no units imported)`);
      continue;
    }

    const expected = {
      total_units: doc.totalUnits ?? 0,
      available_units: doc.availableUnits ?? 0,
      reserved_units: doc.bookedDateCounts?.reservedUnits ?? 0,
      rented_units: doc.bookedDateCounts?.rentedUnits ?? 0,
    };

    for (const [field, expectedValue] of Object.entries(expected)) {
      const actualValue = summary[field as keyof typeof expected];
      if (actualValue !== expectedValue) {
        mismatches.push(
          `${firebaseId} (${field}): Firebase=${expectedValue} vs imported=${actualValue}`,
        );
      }
    }
  }

  console.log(`\nValidation against ${inventoryDocs.length} Firebase inventory docs:`);
  console.log(`  ${notFound.length} inventory doc(s) had no matching product.`);
  if (notFound.length) console.log(`    ${notFound.join(", ")}`);
  console.log(`  ${mismatches.length} field mismatch(es).`);
  for (const m of mismatches) console.log(`    - ${m}`);
  if (!mismatches.length && !notFound.length) console.log("  All totals reconcile.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
