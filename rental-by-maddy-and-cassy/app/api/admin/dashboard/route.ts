import { NextResponse } from "next/server";
import { getAdminDb } from "@/src/lib/firebase/admin";
import {
  enforceRateLimit,
  requireAdmin,
  RequestSecurityError,
} from "@/src/lib/server/requestSecurity";

export const runtime = "nodejs";

const CLOSED_STATUSES = new Set(["completed", "cancelled", "rejected"]);
const VERIFICATION_STATUSES = new Set([
  "submitted",
  "under_review",
  "correction_required",
]);

function isoDate(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return null;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    enforceRateLimit(request, "admin-dashboard-read", 60, 60_000);
    const db = getAdminDb();
    await requireAdmin(request, db);

    const [usersSnapshot, bookingsSnapshot, productsSnapshot, paymentsSnapshot] =
      await Promise.all([
        db.collection("users").get(),
        db.collection("bookings").get(),
        db.collection("products").get(),
        db.collectionGroup("payments").get(),
      ]);

    const usersById = new Map(
      usersSnapshot.docs.map((item) => [
        item.id,
        String(item.data().displayName || "Customer"),
      ]),
    );

    let activeBookings = 0;
    let completedRentals = 0;
    let pendingVerification = 0;
    const productBookingCounts = new Map<string, number>();

    const bookings = bookingsSnapshot.docs.map((item) => {
      const data = item.data();
      const status = String(data.status || "submitted");
      const productName = String(data.productSnapshot?.name || "Rental item");

      if (!CLOSED_STATUSES.has(status)) activeBookings += 1;
      if (status === "completed") completedRentals += 1;
      if (VERIFICATION_STATUSES.has(status)) pendingVerification += 1;
      productBookingCounts.set(
        productName,
        (productBookingCounts.get(productName) ?? 0) + 1,
      );

      return {
        id: item.id,
        bookingRef: String(data.bookingRef || item.id),
        customerName:
          String(data.customerSnapshot?.fullName || "") ||
          usersById.get(String(data.userId || "")) ||
          "Customer",
        productName,
        status,
        createdAt: isoDate(data.createdAt),
      };
    });

    const paidPayments = paymentsSnapshot.docs.filter(
      (item) => item.data().status === "paid",
    );
    const verifiedRevenue = paidPayments.reduce(
      (sum, item) => sum + Number(item.data().amount || 0),
      0,
    );
    const failedPayments = paymentsSnapshot.docs.filter(
      (item) => item.data().status === "failed",
    ).length;
    const popularProduct = [...productBookingCounts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];

    return NextResponse.json({
      metrics: {
        customerAccounts: usersSnapshot.size,
        verifiedRevenue,
        successfulPayments: paidPayments.length,
        failedPayments,
        pendingVerification,
        activeBookings,
        catalogProducts: productsSnapshot.size,
        completedRentals,
        popularProductName: popularProduct?.[0] ?? null,
        popularProductBookings: popularProduct?.[1] ?? 0,
      },
      recentBookings: bookings
        .sort(
          (left, right) =>
            Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""),
        )
        .slice(0, 6),
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin dashboard read failed", error);
    return NextResponse.json(
      { error: "The dashboard data could not be loaded." },
      { status: 500 },
    );
  }
}
