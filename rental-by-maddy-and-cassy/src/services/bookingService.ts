import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import type {
  AgreementStatus,
  Booking,
  BookingCustomerSnapshot,
  BookingProductSnapshot,
  BookingStatus,
  FulfillmentMethod,
  RequirementsStatus,
} from "@/src/types/booking";

export function mapBooking(row: Tables<"bookings">): Booking {
  return {
    id: row.id,
    bookingRef: row.booking_reference,
    userId: row.user_id,
    productId: row.product_id,
    inventoryUnitId: row.inventory_unit_id,
    status: row.status as BookingStatus,
    fulfillmentMethod: row.fulfillment_method as FulfillmentMethod,
    startDate: row.rental_start_date,
    endDate: row.rental_end_date,
    dayCount: row.rental_days ?? 0,
    dailyRate: row.daily_rate,
    refundableDeposit: row.refundable_deposit,
    rentalSubtotal: row.rental_subtotal,
    deliveryFee: row.delivery_fee,
    totalAmount: row.total_amount,
    location: row.location ?? undefined,
    customerNotes: row.customer_notes ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
    productSnapshot: row.product_snapshot as unknown as BookingProductSnapshot,
    customerSnapshot: row.customer_snapshot as unknown as BookingCustomerSnapshot,
    requirementsStatus: row.requirements_status as RequirementsStatus,
    agreementStatus: row.agreement_status as AgreementStatus,
    approvedAt: row.approved_at ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    releasedAt: row.released_at ?? undefined,
    returnedAt: row.returned_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBookingById(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) return null;
  return mapBooking(data);
}

export async function getBookingsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBooking);
}

/** Admin-only: RLS (bookings_admin_manage) reveals every booking to an active admin. */
export async function getAllBookings(supabase: SupabaseClient<Database>): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBooking);
}

/** Renter self-service cancellation, only while still pending/approved — see public.cancel_own_booking(). */
export async function cancelBookingAsCustomer(
  supabase: SupabaseClient<Database>,
  bookingId: string,
  note?: string,
): Promise<Booking> {
  const { data, error } = await supabase.rpc("cancel_own_booking", {
    p_booking_id: bookingId,
    p_note: note,
  });
  if (error || !data) throw new Error(error?.message ?? "The booking could not be cancelled.");
  return mapBooking(data as Tables<"bookings">);
}
