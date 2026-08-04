import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/src/lib/supabase/public";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import type { Review } from "@/src/types/database";

function mapReview(row: Tables<"reviews">): Review {
  return {
    id: row.id,
    bookingId: row.booking_id,
    productId: row.product_id,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment ?? undefined,
    status: row.status as Review["status"],
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
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

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,
      booking_id: input.bookingId,
      product_id: input.productId,
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
    .select("*")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReview);
}
