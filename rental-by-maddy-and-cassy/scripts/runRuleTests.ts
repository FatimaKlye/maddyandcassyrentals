/**
 * Minimal automated tests for the Firestore and Storage security rules,
 * run against the Firebase Emulator Suite via @firebase/rules-unit-testing.
 *
 * These are NOT unit tests in a jest/vitest sense (this repo has no test
 * runner configured) — this is a small standalone script, run with tsx,
 * that exercises the rules the way item 17 of the CMS spec requires and
 * exits non-zero on any failed assertion.
 *
 * Usage:
 *   firebase emulators:start --only firestore,storage
 *   (in another terminal) npm run firebase:test-rules
 */
import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, setLogLevel } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";

setLogLevel("error");

const PROJECT_ID = "maddy-cassy-rules-test";

let passed = 0;
let failed = 0;

async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${(error as Error).message}`);
    failed++;
  }
}

async function main() {
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");
  const storageRules = fs.readFileSync(path.resolve(process.cwd(), "storage.rules"), "utf-8");

  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: firestoreRules, host: "127.0.0.1", port: 8080 },
    storage: { rules: storageRules, host: "127.0.0.1", port: 9199 },
  });

  // ---- seed fixture data as admin (rules bypassed) ----
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "products", "prod-1"), {
      id: "prod-1",
      name: "Test Camera",
      isActive: true,
      pricePerDay: 500,
      currency: "PHP",
      totalUnits: 1,
      availableUnits: 1,
      reservedUnits: 0,
      rentedUnits: 0,
      included: [],
    });
    await setDoc(doc(db, "products", "prod-hidden"), { id: "prod-hidden", isActive: false });
    await setDoc(doc(db, "admins", "admin-uid"), { active: true });
    await setDoc(doc(db, "bookings", "booking-owned-by-alice"), {
      userId: "alice-uid",
      productId: "prod-1",
      status: "submitted",
      assignedUnitId: "unit-1",
      startDate: new Date(),
      endDate: new Date(),
      dayCount: 1,
      fulfillmentMethod: "pickup",
    });
    await setDoc(
      doc(db, "bookings", "booking-owned-by-alice", "payments", "payment-1"),
      {
        bookingId: "booking-owned-by-alice",
        userId: "alice-uid",
        amount: 500,
        status: "paid",
        provider: "paymongo",
      },
    );
    await setDoc(doc(db, "paymentEvents", "evt-1"), {
      type: "checkout_session.payment.paid",
      status: "processed",
    });
    await setDoc(doc(db, "auditLogs", "audit-1"), {
      action: "payment.paid",
      actorType: "system",
      actorId: "paymongo",
      targetType: "payment",
      targetId: "payment-1",
    });

    const storage = context.storage();
    await uploadBytes(
      ref(storage, "private/users/alice-uid/bookings/booking-owned-by-alice/requirements/id-one.jpg"),
      new Uint8Array([1, 2, 3]),
      { contentType: "image/jpeg" }
    );
    await uploadBytes(
      ref(storage, "private/users/alice-uid/bookings/booking-owned-by-alice/documents/receipt.pdf"),
      new Uint8Array([1, 2, 3]),
      { contentType: "application/pdf" },
    );
  });

  const guest = testEnv.unauthenticatedContext();
  const alice = testEnv.authenticatedContext("alice-uid");
  const bob = testEnv.authenticatedContext("bob-uid");
  const admin = testEnv.authenticatedContext("admin-uid");

  console.log("\nFirestore rules:");

  await check("Guest can read a published product", async () => {
    await assertSucceeds(getDoc(doc(guest.firestore(), "products", "prod-1")));
  });

  await check("Guest cannot read an unpublished product", async () => {
    await assertFails(getDoc(doc(guest.firestore(), "products", "prod-hidden")));
  });

  await check("Guest cannot create a booking", async () => {
    await assertFails(
      setDoc(doc(guest.firestore(), "bookings", "guest-booking"), {
        userId: "nobody",
        productId: "prod-1",
        status: "submitted",
        startDate: new Date(),
        endDate: new Date(),
        dayCount: 1,
        fulfillmentMethod: "pickup",
      })
    );
  });

  await check("Customer cannot bypass the secure booking API", async () => {
    await assertFails(
      setDoc(doc(alice.firestore(), "bookings", "alice-new-booking"), {
        userId: "alice-uid",
        assignedUnitId: null,
        productId: "prod-1",
        status: "submitted",
        startDate: new Date(),
        endDate: new Date(),
        dayCount: 1,
        fulfillmentMethod: "pickup",
      })
    );
  });

  await check("Customer cannot read another customer's booking", async () => {
    await assertFails(getDoc(doc(bob.firestore(), "bookings", "booking-owned-by-alice")));
  });

  await check("Customer cannot change a protected booking status directly", async () => {
    await assertFails(
      setDoc(
        doc(alice.firestore(), "bookings", "booking-owned-by-alice"),
        { status: "approved" },
        { merge: true }
      )
    );
  });

  await check("Active admin can read any booking", async () => {
    await assertSucceeds(getDoc(doc(admin.firestore(), "bookings", "booking-owned-by-alice")));
  });

  await check("Non-admin cannot read another customer's booking (admin gate)", async () => {
    await assertFails(getDoc(doc(bob.firestore(), "bookings", "booking-owned-by-alice")));
  });

  await check("Non-admin cannot write products", async () => {
    await assertFails(
      setDoc(doc(bob.firestore(), "products", "prod-1"), { isActive: false }, { merge: true })
    );
  });

  await check("Booking owner can read their server-authored payment record", async () => {
    await assertSucceeds(
      getDoc(
        doc(
          alice.firestore(),
          "bookings",
          "booking-owned-by-alice",
          "payments",
          "payment-1",
        ),
      ),
    );
  });

  await check("Customer cannot forge a payment record", async () => {
    await assertFails(
      setDoc(
        doc(
          alice.firestore(),
          "bookings",
          "booking-owned-by-alice",
          "payments",
          "forged",
        ),
        { userId: "alice-uid", amount: 1, status: "paid" },
      ),
    );
  });

  await check("Customer cannot read payment webhook events", async () => {
    await assertFails(getDoc(doc(alice.firestore(), "paymentEvents", "evt-1")));
  });

  await check("Active admin can inspect payment events and audit logs", async () => {
    await assertSucceeds(getDoc(doc(admin.firestore(), "paymentEvents", "evt-1")));
    await assertSucceeds(getDoc(doc(admin.firestore(), "auditLogs", "audit-1")));
  });

  await check("Admin cannot rewrite immutable audit history", async () => {
    await assertFails(
      setDoc(doc(admin.firestore(), "auditLogs", "audit-1"), { action: "tampered" }),
    );
  });

  console.log("\nStorage rules:");

  await check("Customer can upload their own requirement file", async () => {
    await assertSucceeds(
      uploadBytes(
        ref(
          alice.storage(),
          "private/users/alice-uid/bookings/booking-owned-by-alice/requirements/id-two.jpg"
        ),
        new Uint8Array([1, 2, 3]),
        { contentType: "image/jpeg" }
      )
    );
  });

  await check("Customer cannot access another customer's files", async () => {
    await assertFails(
      getBytes(
        ref(
          bob.storage(),
          "private/users/alice-uid/bookings/booking-owned-by-alice/requirements/id-one.jpg"
        )
      )
    );
  });

  await check("Active admin can read a customer's requirement file", async () => {
    await assertSucceeds(
      getBytes(
        ref(
          admin.storage(),
          "private/users/alice-uid/bookings/booking-owned-by-alice/requirements/id-one.jpg"
        )
      )
    );
  });

  await check("Booking owner can read but cannot upload final financial documents", async () => {
    const receiptRef = ref(
      alice.storage(),
      "private/users/alice-uid/bookings/booking-owned-by-alice/documents/receipt.pdf",
    );
    await assertSucceeds(getBytes(receiptRef));
    await assertFails(
      uploadBytes(receiptRef, new Uint8Array([4, 5, 6]), {
        contentType: "application/pdf",
      }),
    );
  });

  await testEnv.cleanup();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Rule test run failed to start:", error);
  console.error(
    "Make sure the Firestore + Storage emulators are running first: firebase emulators:start"
  );
  process.exit(1);
});
