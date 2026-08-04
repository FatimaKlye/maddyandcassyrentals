import { NextResponse } from "next/server";
import { enforceRateLimit, requireActiveAdmin, RequestSecurityError } from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

const CLOSED_STATUSES = new Set(["returned", "cancelled"]);

export async function GET(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-dashboard-read", 60, 60_000);
    const { supabase } = await requireActiveAdmin();

    const [
      { count: customerAccounts },
      { count: catalogProducts },
      { data: bookings },
      { data: payments },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase
        .from("bookings")
        .select("id, booking_reference, status, requirements_status, product_snapshot, customer_snapshot, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("payment_records").select("amount, status"),
    ]);

    const bookingRows = bookings ?? [];
    let activeBookings = 0;
    let completedRentals = 0;
    let pendingVerification = 0;
    const productBookingCounts = new Map<string, number>();

    for (const booking of bookingRows) {
      if (!CLOSED_STATUSES.has(booking.status)) activeBookings += 1;
      if (booking.status === "returned") completedRentals += 1;
      if (booking.requirements_status === "pending_review") pendingVerification += 1;
      const productName = (booking.product_snapshot as { name?: string })?.name || "Rental item";
      productBookingCounts.set(productName, (productBookingCounts.get(productName) ?? 0) + 1);
    }

    const paymentRows = payments ?? [];
    const paidPayments = paymentRows.filter((p) => p.status === "paid" || p.status === "verified");
    const verifiedRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const failedPayments = paymentRows.filter((p) => p.status === "failed").length;
    const popularProduct = [...productBookingCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    return NextResponse.json({
      metrics: {
        customerAccounts: customerAccounts ?? 0,
        verifiedRevenue,
        successfulPayments: paidPayments.length,
        failedPayments,
        pendingVerification,
        activeBookings,
        catalogProducts: catalogProducts ?? 0,
        completedRentals,
        popularProductName: popularProduct?.[0] ?? null,
        popularProductBookings: popularProduct?.[1] ?? 0,
      },
      recentBookings: bookingRows.slice(0, 6).map((booking) => ({
        id: booking.id,
        bookingRef: booking.booking_reference,
        customerName: (booking.customer_snapshot as { fullName?: string })?.fullName || "Customer",
        productName: (booking.product_snapshot as { name?: string })?.name || "Rental item",
        status: booking.status,
        createdAt: booking.created_at,
      })),
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin dashboard read failed", error);
    return NextResponse.json({ error: "The dashboard data could not be loaded." }, { status: 500 });
  }
}
