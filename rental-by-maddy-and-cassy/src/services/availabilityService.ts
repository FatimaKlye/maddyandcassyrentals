import { collection, getDocs, query, where } from "firebase/firestore";
import { eachDayOfInterval, formatISO } from "date-fns";
import { db } from "@/src/lib/firebase/config";

const INVENTORY_UNITS_COLLECTION = "inventoryUnits";

export const MAX_RENTAL_DAYS = 30;

export function toDateKey(date: Date): string {
  return formatISO(date, { representation: "date" });
}

/**
 * Active unit ids for a product, using the same eligibility rule as the
 * /api/bookings/submit transaction (src/lib/firebase/admin.ts consumer) so
 * the calendar and the real booking guard never disagree about which units
 * count.
 */
async function getActiveUnitIds(productId: string): Promise<string[]> {
  const unitsQuery = query(
    collection(db, INVENTORY_UNITS_COLLECTION),
    where("productId", "==", productId),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(unitsQuery);
  return snapshot.docs
    .filter((unitDoc) => {
      const status = unitDoc.data().status;
      return status !== "inactive" && status !== "maintenance";
    })
    .map((unitDoc) => unitDoc.id);
}

/** Date keys ("YYYY-MM-DD") with an existing calendar lock for one unit. */
async function getUnitLockedDateKeys(unitId: string): Promise<Set<string>> {
  const snapshot = await getDocs(
    collection(db, INVENTORY_UNITS_COLLECTION, unitId, "calendar")
  );
  return new Set(snapshot.docs.map((calendarDoc) => calendarDoc.id));
}

/**
 * Returns the set of "YYYY-MM-DD" date keys on which every active unit of a
 * product already has a calendar lock in Firestore
 * (inventoryUnits/{unitId}/calendar/{dateKey}) — the same per-unit source of
 * truth the /api/bookings/submit transaction locks against. A date stays
 * available as long as at least one active unit has no lock for it.
 */
export async function getFullyBookedDateKeys(productId: string): Promise<Set<string>> {
  const activeUnitIds = await getActiveUnitIds(productId);
  if (activeUnitIds.length === 0) return new Set();

  const lockedSets = await Promise.all(activeUnitIds.map(getUnitLockedDateKeys));

  const candidateKeys = new Set<string>();
  for (const lockedSet of lockedSets) {
    for (const key of lockedSet) candidateKeys.add(key);
  }

  const fullyBooked = new Set<string>();
  for (const key of candidateKeys) {
    if (lockedSets.every((lockedSet) => lockedSet.has(key))) {
      fullyBooked.add(key);
    }
  }
  return fullyBooked;
}

/**
 * Fast, non-atomic pre-check: is the given date range still free for at
 * least one unit? This is a UX-only optimization — the real guard is the
 * Firestore transaction inside /api/bookings/submit, which re-reads the
 * same calendar docs atomically before creating a booking.
 */
export async function isRangeAvailable(
  productId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const fullyBooked = await getFullyBookedDateKeys(productId);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.every((day) => !fullyBooked.has(toDateKey(day)));
}
