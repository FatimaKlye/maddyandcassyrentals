/**
 * Firebase database seed script — Admin SDK, server-only.
 *
 * Seeds ONLY the static/bootstrap records the CMS needs to start from:
 *   - products/{id}            (from data/products.ts)
 *   - inventoryUnits/{unitId}  (from PRODUCT_UNIT_COUNTS below)
 *   - inventory/{id}           (legacy display-count cache the catalog UI reads)
 *   - websiteContent/{id}      (placeholder legal/informational copy)
 *   - admins/{uid}             (first administrator, from SEED_ADMIN_UID)
 *
 * Safe to re-run: every write uses `set(..., { merge: true })` and never
 * clobbers live booking/inventory state that already exists.
 *
 * ---------------------------------------------------------------------------
 * Setting up the first administrator (do this once per environment):
 *   1. Register a normal account through the app's sign-up page (Firebase
 *      Authentication + users/{uid} doc are created automatically).
 *   2. Copy that account's Firebase UID from the Firebase Console
 *      (Authentication > Users) or the emulator UI.
 *   3. Put it in .env.local as SEED_ADMIN_UID=<uid>.
 *   4. Run this script (see commands below). It will create admins/{uid}
 *      with { active: true, createdAt }.
 * If SEED_ADMIN_UID is not set, this script skips admin seeding entirely
 * and prints a warning — it will never guess a UID.
 * ---------------------------------------------------------------------------
 * Actual physical inventory counts are NOT known yet. Every entry in
 * PRODUCT_UNIT_COUNTS below defaults to a placeholder value of 1 unit
 * (clearly marked). Replace these with the client's real per-product
 * physical unit counts before seeding a production project.
 * ---------------------------------------------------------------------------
 *
 * Run against the Firebase Emulator Suite (no credentials needed):
 *   firebase emulators:start
 *   (in another terminal) npm run firebase:seed
 *
 * Run against a real Firebase project (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\maddy-cassy-service-account.json"
 *   npm run firebase:seed
 */
import fs from "node:fs";
import path from "node:path";
import { products } from "@/data/products";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

// PLACEHOLDER — every count below is a safe default of 1, NOT the client's
// real inventory. Fill in actual per-product physical unit counts here and
// have them reviewed before seeding a production project.
const PRODUCT_UNIT_COUNTS: Record<string, number> = {
  // "iphone-17-pro-max": 4,
};
const DEFAULT_UNIT_COUNT_PLACEHOLDER = 1;

function unitCountFor(productId: string): number {
  return PRODUCT_UNIT_COUNTS[productId] ?? DEFAULT_UNIT_COUNT_PLACEHOLDER;
}

const WEBSITE_CONTENT: Array<{
  id: string;
  title: string;
  content: string;
  displayOrder: number;
}> = [
  {
    id: "booking-process",
    title: "Booking Process",
    content:
      "PLACEHOLDER — describe the step-by-step booking process here (select item, choose dates, submit requirements, sign agreement, await approval). Replace with client-approved copy before launch.",
    displayOrder: 1,
  },
  {
    id: "rental-requirements",
    title: "Rental Requirements",
    content:
      "PLACEHOLDER — list accepted valid IDs, emergency contact requirements, and any other rental prerequisites. Replace with client-approved copy before launch.",
    displayOrder: 2,
  },
  {
    id: "terms-and-conditions",
    title: "Terms and Conditions",
    content:
      "PLACEHOLDER — full rental terms and conditions text goes here. This is NOT final legal text; it must be reviewed and approved by the client before production use.",
    displayOrder: 3,
  },
  {
    id: "faqs",
    title: "Frequently Asked Questions",
    content:
      "PLACEHOLDER — frequently asked questions and answers go here. Replace with client-approved copy before launch.",
    displayOrder: 4,
  },
  {
    id: "pickup-delivery",
    title: "Pickup & Delivery",
    content:
      "PLACEHOLDER — describe pickup location/hours and delivery arrangement details here. Replace with client-approved copy before launch.",
    displayOrder: 5,
  },
];

interface SeedCounts {
  productsCreated: number;
  productsUpdated: number;
  unitsCreated: number;
  unitsUpdated: number;
  contentCreated: number;
  contentUpdated: number;
  adminSeeded: boolean;
}

async function main() {
  // Imported lazily so this script can run even if GOOGLE_APPLICATION_CREDENTIALS
  // / emulator env vars are only set by loadEnvLocal() above, before the
  // Admin SDK reads them at module-init time.
  const { adminDb } = await import("@/src/lib/firebase/admin");
  const { FieldValue } = await import("firebase-admin/firestore");

  const counts: SeedCounts = {
    productsCreated: 0,
    productsUpdated: 0,
    unitsCreated: 0,
    unitsUpdated: 0,
    contentCreated: 0,
    contentUpdated: 0,
    adminSeeded: false,
  };

  console.log(`Seeding ${products.length} products + inventory units...`);

  for (const product of products) {
    const { id, ...productData } = product;
    const productRef = adminDb.collection("products").doc(id);
    const existingProduct = await productRef.get();

    await productRef.set(
      {
        id,
        ...productData,
        status: productData.availableUnits > 0 ? "Available" : "Booked",
        isActive: true,
        createdAt: existingProduct.exists ? existingProduct.get("createdAt") : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    if (existingProduct.exists) {
      counts.productsUpdated++;
    } else {
      counts.productsCreated++;
    }

    const totalUnits = unitCountFor(id);

    // Legacy display cache read by the catalog UI (see hooks/useInventory.ts).
    const inventoryRef = adminDb.collection("inventory").doc(id);
    const existingInventory = await inventoryRef.get();
    await inventoryRef.set(
      {
        totalUnits,
        availableUnits: existingInventory.exists ? existingInventory.get("availableUnits") : totalUnits,
        reservedUnits: existingInventory.exists ? existingInventory.get("reservedUnits") : 0,
        rentedUnits: existingInventory.exists ? existingInventory.get("rentedUnits") : 0,
        ...(existingInventory.exists ? {} : { bookedDateCounts: {} }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Physical inventoryUnits/{unitId} — the source of truth for reservation
    // correctness (see src/services/reservationService.ts).
    for (let i = 1; i <= totalUnits; i++) {
      const unitId = `${id}-unit-${i}`;
      const unitRef = adminDb.collection("inventoryUnits").doc(unitId);
      const existingUnit = await unitRef.get();

      await unitRef.set(
        {
          id: unitId,
          productId: id,
          unitCode: `${id.toUpperCase()}-${String(i).padStart(2, "0")}`,
          status: existingUnit.exists ? existingUnit.get("status") : "available",
          isActive: true,
          createdAt: existingUnit.exists ? existingUnit.get("createdAt") : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (existingUnit.exists) {
        counts.unitsUpdated++;
      } else {
        counts.unitsCreated++;
      }
    }

    console.log(`  seeded ${id} (${totalUnits} unit${totalUnits === 1 ? "" : "s"})`);
  }

  console.log(`Seeding ${WEBSITE_CONTENT.length} website content records...`);
  for (const entry of WEBSITE_CONTENT) {
    const ref = adminDb.collection("websiteContent").doc(entry.id);
    const existing = await ref.get();

    await ref.set(
      {
        id: entry.id,
        title: entry.title,
        content: entry.content,
        displayOrder: entry.displayOrder,
        isPublished: true,
        createdAt: existing.exists ? existing.get("createdAt") : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    if (existing.exists) {
      counts.contentUpdated++;
    } else {
      counts.contentCreated++;
    }
  }

  const seedAdminUid = process.env.SEED_ADMIN_UID?.trim();
  if (seedAdminUid) {
    console.log(`Seeding first administrator: admins/${seedAdminUid}`);
    await adminDb.collection("admins").doc(seedAdminUid).set(
      {
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    counts.adminSeeded = true;
  } else {
    console.warn(
      "SEED_ADMIN_UID is not set — skipping admins/{uid} seeding. " +
        "See the setup instructions at the top of this script."
    );
  }

  console.log("\nSeed summary:");
  console.log(`  products:   ${counts.productsCreated} created, ${counts.productsUpdated} updated`);
  console.log(`  units:      ${counts.unitsCreated} created, ${counts.unitsUpdated} updated`);
  console.log(`  content:    ${counts.contentCreated} created, ${counts.contentUpdated} updated`);
  console.log(`  admin:      ${counts.adminSeeded ? "seeded" : "skipped (no SEED_ADMIN_UID)"}`);
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
