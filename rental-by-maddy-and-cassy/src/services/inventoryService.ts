import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { eachDayOfInterval } from "date-fns";
import { db } from "@/src/lib/firebase/config";
import type { UnitCounts } from "@/lib/availability";
import { toDateKey } from "@/src/services/availabilityService";
import type { BookingProductSnapshot, FulfillmentMethod } from "@/src/types/booking";

const INVENTORY_COLLECTION = "inventory";
const INVENTORY_UNITS_COLLECTION = "inventoryUnits";
const BOOKINGS_COLLECTION = "bookings";

export class InsufficientUnitsError extends Error {
  constructor(productId: string) {
    super(`No available units left for product "${productId}".`);
    this.name = "InsufficientUnitsError";
  }
}

export class DatesUnavailableError extends Error {
  constructor() {
    super("One or more selected dates are no longer available for this product.");
    this.name = "DatesUnavailableError";
  }
}

function generateBookingRef(bookingId: string): string {
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const suffix = bookingId.slice(-5).toUpperCase();
  return `MC-${datePart}-${suffix}`;
}

interface SubmitBookingWithDateGuardInput {
  productId: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  dayCount: number;
  fulfillmentMethod: FulfillmentMethod;
  customerLocation: string;
  productSnapshot: BookingProductSnapshot;
}

export interface SubmitBookingWithDateGuardResult {
  bookingId: string;
  bookingRef: string;
  assignedUnitId: string;
}

/**
 * Atomically reserves one physical inventory unit for the given date range
 * and creates the booking doc, per this order of operations:
 *   1. Compute the requested date keys.
 *   2. Find active physical units for the product (inventoryUnits).
 *   3. Inside a transaction, read that unit's calendar entries for each
 *      requested date.
 *   4. Pick the first unit with no conflicting calendar entry on any date.
 *   5. Create the booking doc, with assignedUnitId set.
 *   6. Create a calendar lock doc per date on that unit.
 *   7. Commit all reads/writes as a single transaction.
 *
 * Firestore transactions guarantee steps 3-7 are atomic and serialized
 * against concurrent transactions touching the same documents, which is
 * what prevents two customers from reserving the last available unit at
 * the same time.
 */
export async function submitBookingWithDateGuard({
  productId,
  userId,
  startDate,
  endDate,
  dayCount,
  fulfillmentMethod,
  customerLocation,
  productSnapshot,
}: SubmitBookingWithDateGuardInput): Promise<SubmitBookingWithDateGuardResult> {
  const dateKeys = eachDayOfInterval({ start: startDate, end: endDate }).map(toDateKey);

  const unitsQuery = query(
    collection(db, INVENTORY_UNITS_COLLECTION),
    where("productId", "==", productId),
    where("isActive", "==", true)
  );
  const unitsSnapshot = await getDocs(unitsQuery);
  const candidateUnitIds = unitsSnapshot.docs.map((d) => d.id).sort();

  if (candidateUnitIds.length === 0) {
    throw new InsufficientUnitsError(productId);
  }

  const bookingRef = doc(collection(db, BOOKINGS_COLLECTION));
  const bookingRefCode = generateBookingRef(bookingRef.id);
  const inventoryRef = doc(db, INVENTORY_COLLECTION, productId);

  let assignedUnitId: string | null = null;

  await runTransaction(db, async (transaction) => {
    // All reads must happen before any writes within a Firestore transaction,
    // so gather calendar reads for each candidate unit until we find one
    // that's free for every requested date.
    for (const unitId of candidateUnitIds) {
      let unitIsFree = true;
      for (const dateKey of dateKeys) {
        const calendarRef = doc(db, INVENTORY_UNITS_COLLECTION, unitId, "calendar", dateKey);
        const calendarSnapshot = await transaction.get(calendarRef);
        if (calendarSnapshot.exists()) {
          unitIsFree = false;
          break;
        }
      }
      if (unitIsFree) {
        assignedUnitId = unitId;
        break;
      }
    }

    if (!assignedUnitId) {
      throw new DatesUnavailableError();
    }

    const inventorySnapshot = await transaction.get(inventoryRef);
    const pricePerDaySnapshot = productSnapshot.pricePerDay;

    transaction.set(bookingRef, {
      bookingRef: bookingRefCode,
      userId,
      productId,
      assignedUnitId,
      productSnapshot,
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      dayCount,
      fulfillmentMethod,
      customerLocation,
      pricePerDaySnapshot,
      estimatedRentalAmount: pricePerDaySnapshot * dayCount,
      status: "submitted",
      requirementsStatus: "not_submitted",
      agreementStatus: "awaiting_customer_signature",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
    });

    for (const dateKey of dateKeys) {
      const calendarRef = doc(db, INVENTORY_UNITS_COLLECTION, assignedUnitId, "calendar", dateKey);
      transaction.set(calendarRef, {
        unitId: assignedUnitId,
        productId,
        bookingId: bookingRef.id,
        dateKey,
        status: "pending",
        startAt: Timestamp.fromDate(startDate),
        endAt: Timestamp.fromDate(endDate),
        createdAt: serverTimestamp(),
      });
    }

    // Best-effort display cache update (see firestore.rules comment on
    // /inventory/{productId}) — never the source of reservation truth.
    if (inventorySnapshot.exists()) {
      const inventory = inventorySnapshot.data();
      const totalUnits: number = inventory.totalUnits ?? candidateUnitIds.length;
      const reservedUnits: number = Math.min(totalUnits, (inventory.reservedUnits ?? 0) + 1);
      const availableUnits: number = Math.max(0, totalUnits - reservedUnits - (inventory.rentedUnits ?? 0));

      // bookedDateCounts is the public per-date aggregate that
      // availabilityService.ts reads to grey out fully-booked dates — a
      // signed-in customer cannot query the bookings collection across
      // other customers, so this cache is the only rules-compatible way to
      // expose "is this date fully booked" to the reservation UI.
      const bookedDateCounts: Record<string, number> = { ...(inventory.bookedDateCounts ?? {}) };
      for (const dateKey of dateKeys) {
        bookedDateCounts[dateKey] = (bookedDateCounts[dateKey] ?? 0) + 1;
      }

      transaction.set(
        inventoryRef,
        { totalUnits, reservedUnits, availableUnits, bookedDateCounts, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  });

  return { bookingId: bookingRef.id, bookingRef: bookingRefCode, assignedUnitId: assignedUnitId! };
}

export async function ensureInventoryDoc(
  productId: string,
  defaults: UnitCounts
): Promise<void> {
  const ref = doc(db, INVENTORY_COLLECTION, productId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    await setDoc(ref, { ...defaults, updatedAt: serverTimestamp() });
  }
}

export function subscribeToInventory(
  productId: string,
  callback: (units: UnitCounts | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, INVENTORY_COLLECTION, productId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      const data = snapshot.data();
      callback({
        totalUnits: data.totalUnits,
        availableUnits: data.availableUnits,
        reservedUnits: data.reservedUnits,
        rentedUnits: data.rentedUnits,
      });
    },
    () => callback(null)
  );
}

export function subscribeToAllInventory(
  callback: (unitsByProductId: Map<string, UnitCounts>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, INVENTORY_COLLECTION),
    (snapshot: QuerySnapshot<DocumentData>) => {
      const map = new Map<string, UnitCounts>();
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        map.set(docSnapshot.id, {
          totalUnits: data.totalUnits,
          availableUnits: data.availableUnits,
          reservedUnits: data.reservedUnits,
          rentedUnits: data.rentedUnits,
        });
      });
      callback(map);
    },
    () => callback(new Map())
  );
}
