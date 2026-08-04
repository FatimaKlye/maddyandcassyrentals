import { eachDayOfInterval, formatISO } from "date-fns";
import { createPublicClient } from "@/src/lib/supabase/public";

export const MAX_RENTAL_DAYS = 30;

export function toDateKey(date: Date): string {
  return formatISO(date, { representation: "date" });
}

/**
 * Date keys ("YYYY-MM-DD") on which every unit of a product is already
 * held by a 'reserving' or 'booked' calendar entry. This is a public,
 * non-atomic read (product_availability_summary + availability_calendar_entries
 * are both readable by anon/authenticated for active products) used only to
 * grey out the reservation calendar — the real guard is the
 * public.create_booking() RPC, which re-checks conflicts with row locks at
 * submission time.
 */
export async function getFullyBookedDateKeys(productId: string): Promise<Set<string>> {
  const supabase = createPublicClient();

  const [{ data: summary }, { data: entries, error }] = await Promise.all([
    supabase
      .from("product_availability_summary")
      .select("total_units")
      .eq("product_id", productId)
      .maybeSingle(),
    supabase
      .from("availability_calendar_entries")
      .select("start_date, end_date")
      .eq("product_id", productId)
      .in("status", ["reserving", "booked"]),
  ]);

  if (error) throw new Error(error.message);

  const totalUnits = summary?.total_units ?? 0;
  if (totalUnits <= 0) return new Set();

  const countByDate = new Map<string, number>();
  for (const entry of entries ?? []) {
    const days = eachDayOfInterval({
      start: new Date(`${entry.start_date}T00:00:00`),
      end: new Date(`${entry.end_date}T00:00:00`),
    });
    for (const day of days) {
      const key = toDateKey(day);
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }
  }

  const fullyBooked = new Set<string>();
  for (const [key, count] of countByDate) {
    if (count >= totalUnits) fullyBooked.add(key);
  }
  return fullyBooked;
}

export async function isRangeAvailable(
  productId: string,
  startDate: Date,
  endDate: Date,
): Promise<boolean> {
  const fullyBooked = await getFullyBookedDateKeys(productId);
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.every((day) => !fullyBooked.has(toDateKey(day)));
}
