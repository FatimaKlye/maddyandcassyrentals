import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/src/lib/supabase/public";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import type { Review } from "@/src/types/database";

// public.reviews no longer carries booking_id/product_id/user_id directly —
// it's keyed by booking_item_id, so those are resolved by joining through
// booking_items (product_id) and booking_items -> bookings (customer_id),
// mirroring the join private.get_product_reviews_internal() uses.

type ReviewRow = Pick<
  Tables<"reviews">,
  "id" | "comment" | "rating" | "status" | "created_at" | "moderated_at" | "moderated_by"
> & {
  booking_items:
    | (Pick<Tables<"booking_items">, "product_id" | "booking_id"> & {
        bookings: Pick<Tables<"bookings">, "customer_id"> | null;
      })
    | null;
};

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    bookingId: row.booking_items?.booking_id ?? "",
    productId: row.booking_items?.product_id ?? "",
    userId: row.booking_items?.bookings?.customer_id ?? "",
    rating: row.rating,
    comment: row.comment ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    moderatedAt: row.moderated_at ?? undefined,
    moderatedBy: row.moderated_by ?? undefined,
  };
}

/**
 * RLS (reviews_customer_insert_returned_booking) independently re-verifies
 * that the booking belongs to this customer, is for this product, and has
 * status 'returned' — this is only a convenience wrapper.
 */
export async function submitReview(
  supabase: SupabaseClient<Database>,
  input: {
    bookingId: string;
    productId: string;
    rating: number;
    comment?: string;
  },
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to leave a review.");

  const { data: item, error: itemError } = await supabase
    .from("booking_items")
    .select("id")
    .eq("booking_id", input.bookingId)
    .eq("product_id", input.productId)
    .maybeSingle();
  if (itemError || !item) {
    throw new Error("This booking does not include the selected product.");
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      booking_item_id: item.id,
      rating: input.rating,
      comment: input.comment ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "The review could not be submitted.");
  return data.id;
}

export async function getApprovedReviewsForProduct(productId: string): Promise<Review[]> {
  const { data, error } = await createPublicClient()
    .from("reviews")
    .select(
      "id, comment, rating, status, created_at, moderated_at, moderated_by, booking_items!inner(product_id, booking_id, bookings(customer_id))",
    )
    .eq("booking_items.product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ReviewRow[]).map(mapReview);
}
