import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import { toJson } from "@/src/lib/supabase/types";
import type { UnitCounts } from "@/lib/availability";
import type {
  BookingCustomerSnapshot,
  BookingProductSnapshot,
  EmergencyContact,
  FulfillmentMethod,
} from "@/src/types/booking";

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

export class AccountSuspendedError extends Error {
  constructor() {
    super("Your account is suspended and cannot create new bookings.");
    this.name = "AccountSuspendedError";
  }
}

export interface SubmitBookingInput {
  productId: string;
  rentalStartDate: string;
  rentalEndDate: string;
  fulfillmentMethod: FulfillmentMethod;
  location?: string;
  customerNotes?: string;
  deliveryFee?: number;
  discountAmount?: number;
  productSnapshot: BookingProductSnapshot;
  customerSnapshot: BookingCustomerSnapshot;
  emergencyContact?: EmergencyContact;
}

export interface SubmitBookingResult {
  bookingId: string;
  bookingRef: string;
  assignedUnitId: string | null;
}

/**
 * Atomically reserves one physical unit and creates the booking by calling
 * public.create_booking() — a SECURITY DEFINER Postgres function that row-locks
 * candidate inventory_units and re-checks date-range conflicts against
 * public.bookings server-side (see the migration in
 * supabase/migrations/20260802000000_paymongo_audit_push_agreement_versions.sql).
 * This is the real guard; any client-side date-picker check is UX only.
 */
export async function submitBookingWithDateGuard(
  supabase: SupabaseClient<Database>,
  input: SubmitBookingInput,
): Promise<SubmitBookingResult> {
  const { data, error } = await supabase.rpc("create_booking", {
    p_product_id: input.productId,
    p_rental_start_date: input.rentalStartDate,
    p_rental_end_date: input.rentalEndDate,
    p_fulfillment_method: input.fulfillmentMethod,
    p_location: input.location ?? "",
    p_customer_notes: input.customerNotes ?? "",
    p_delivery_fee: input.deliveryFee ?? 0,
    p_discount_amount: input.discountAmount ?? 0,
    p_product_snapshot: toJson(input.productSnapshot),
    p_customer_snapshot: toJson(input.customerSnapshot),
    p_emergency_contact: input.emergencyContact
      ? {
          fullName: input.emergencyContact.fullName,
          relationship: input.emergencyContact.relationship,
          phoneNumber: input.emergencyContact.phoneNumber,
          address: input.emergencyContact.address ?? "",
        }
      : null,
  });

  if (error) {
    if (error.message.includes("NO_AVAILABILITY")) throw new DatesUnavailableError();
    if (error.message.includes("PRODUCT_NOT_AVAILABLE")) {
      throw new InsufficientUnitsError(input.productId);
    }
    if (error.message.includes("ACCOUNT_SUSPENDED")) throw new AccountSuspendedError();
    throw new Error(error.message);
  }

  const booking = data as Tables<"bookings">;
  return {
    bookingId: booking.id,
    bookingRef: booking.booking_reference,
    assignedUnitId: booking.inventory_unit_id,
  };
}

function mapSummary(row: Tables<"product_availability_summary">): UnitCounts {
  return {
    totalUnits: row.total_units,
    availableUnits: row.available_units,
    reservedUnits: row.reserved_units,
    rentedUnits: row.rented_units,
  };
}

export function subscribeToInventory(
  supabase: SupabaseClient<Database>,
  productId: string,
  callback: (units: UnitCounts | null) => void,
): () => void {
  supabase
    .from("product_availability_summary")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle()
    .then(({ data }) => callback(data ? mapSummary(data) : null));

  const channel = supabase
    .channel(`inventory-${productId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "product_availability_summary",
        filter: `product_id=eq.${productId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as
          | Tables<"product_availability_summary">
          | undefined;
        callback(row ? mapSummary(row) : null);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToAllInventory(
  supabase: SupabaseClient<Database>,
  callback: (unitsByProductId: Map<string, UnitCounts>) => void,
): () => void {
  const state = new Map<string, UnitCounts>();

  supabase
    .from("product_availability_summary")
    .select("*")
    .then(({ data }) => {
      for (const row of data ?? []) {
        state.set(row.product_id, mapSummary(row));
      }
      callback(new Map(state));
    });

  const channel = supabase
    .channel("inventory-all")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "product_availability_summary" },
      (payload) => {
        const row = (payload.new ?? payload.old) as
          | Tables<"product_availability_summary">
          | undefined;
        if (!row) return;
        state.set(row.product_id, mapSummary(row));
        callback(new Map(state));
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
