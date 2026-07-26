import { doc, getDoc } from "firebase/firestore";
import { eachDayOfInterval, formatISO } from "date-fns";
import { db } from "@/src/lib/firebase/config";

const INVENTORY_COLLECTION = "inventory";

export const MAX_RENTAL_DAYS = 30;

export function toDateKey(date: Date): string {
  return formatISO(date, { representation: "date" });
}

/**
 * Returns the set of "YYYY-MM-DD" dates on which every unit of a product is
 * already committed to an active booking.
 *
 * This reads the publicly-readable inventory/{productId}.bookedDateCounts
 * aggregate (maintained by the reservation transaction in
 * inventoryService.ts) rather than querying the bookings collection
 * directly — firestore.rules only lets a signed-in customer read their own
 * bookings, so a cross-customer query for "every booking on this product"
 * is always rejected regardless of who's asking.
 */
export async function getFullyBookedDateKeys(
  productId: string,
  totalUnits: number
): Promise<Set<string>> {
  const snapshot = await getDoc(doc(db, INVENTORY_COLLECTION, productId));
  const bookedDateCounts: Record<string, number> = snapshot.exists()
    ? (snapshot.data().bookedDateCounts ?? {})
    : {};

  const fullyBooked = new Set<string>();
  for (const [key, count] of Object.entries(bookedDateCounts)) {
    if (count >= totalUnits) fullyBooked.add(key);
  }
  return fullyBooked;
}

/**
 * Fast, non-atomic pre-check: is the given date range still free for at
 * least one unit, given currently active bookings? This is a UX-only
 * optimization — the real guard is the transaction in
 * submitBookingWithDateGuard (src/services/inventoryService.ts).
 */
export async function isRangeAvailable(
  productId: string,
  totalUnits: number,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const fullyBooked = await getFullyBookedDateKeys(productId, totalUnits);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.every((day) => !fullyBooked.has(toDateKey(day)));
}
