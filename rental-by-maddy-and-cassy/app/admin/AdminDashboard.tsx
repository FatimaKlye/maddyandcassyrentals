"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getAllBookings } from "@/src/services/bookingService";
import { getAllProducts } from "@/src/services/productService";
import { getAllUsers } from "@/src/services/userService";
import type { Booking, UserProfile } from "@/src/types/firebase";
import type { Product } from "@/types/product";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/status-badge/StatusBadge";
import styles from "./admin.module.css";
import { getAllPaymentRecords } from "@/src/services/operationsService";
import type { PaymentRecord } from "@/src/types/payment";

interface DashboardData {
  users: UserProfile[];
  bookings: Booking[];
  products: Product[];
  payments: PaymentRecord[];
}

const closedStatuses = new Set(["completed", "cancelled", "rejected"]);

function timestampMillis(value: Booking["createdAt"]): number {
  return value?.toMillis?.() ?? 0;
}

function formatDate(value: Booking["createdAt"]): string {
  return value?.toDate?.().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) ?? "—";
}

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getAllUsers(), getAllBookings(), getAllProducts(), getAllPaymentRecords()])
      .then(([users, bookings, products, payments]) => {
        if (active) setData({ users, bookings, products, payments });
      })
      .catch(() => {
        if (active) setError("The dashboard data could not be loaded. Please refresh and try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const recentBookings = useMemo(
    () =>
      [...(data?.bookings ?? [])]
        .sort((left, right) => timestampMillis(right.createdAt) - timestampMillis(left.createdAt))
        .slice(0, 6),
    [data]
  );

  const usersById = useMemo(
    () => new Map((data?.users ?? []).map((customer) => [customer.uid, customer])),
    [data]
  );

  const displayName = profile?.displayName ?? user?.displayName ?? "Administrator";
  const activeBookings =
    data?.bookings.filter((booking) => !closedStatuses.has(booking.status)).length ?? 0;
  const completedRentals =
    data?.bookings.filter((booking) => booking.status === "completed").length ?? 0;
  const paidPayments = data?.payments.filter((payment) => payment.status === "paid") ?? [];
  const verifiedRevenue = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const failedPayments =
    data?.payments.filter((payment) => payment.status === "failed").length ?? 0;
  const pendingVerification =
    data?.bookings.filter((booking) =>
      ["submitted", "under_review", "correction_required"].includes(booking.status),
    ).length ?? 0;
  const productBookingCounts = new Map<string, number>();
  data?.bookings.forEach((booking) => {
    productBookingCounts.set(
      booking.productSnapshot.name,
      (productBookingCounts.get(booking.productSnapshot.name) ?? 0) + 1,
    );
  });
  const popularProduct = [...productBookingCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>ADMIN DASHBOARD</p>
          <h1>Welcome, {displayName}</h1>
          <p>Monitor customer accounts, bookings, and rental catalog activity.</p>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!data && !error ? (
        <div className={styles.loading}>
          <Spinner size={28} label="Loading admin dashboard" />
        </div>
      ) : data ? (
        <>
          <section className={styles.metrics} aria-label="Business overview">
            <article className={styles.metricCard}>
              <span>Customer Accounts</span>
              <strong>{data.users.length}</strong>
              <Link href="/admin/users">View all users</Link>
            </article>
            <article className={styles.metricCard}>
              <span>Verified Revenue</span>
              <strong>PHP {verifiedRevenue.toLocaleString("en-PH")}</strong>
              <Link href="/admin/payments">View payment activity</Link>
            </article>
            <article className={styles.metricCard}>
              <span>Successful Payments</span>
              <strong>{paidPayments.length}</strong>
              <small>Verified through PayMongo webhooks</small>
            </article>
            <article className={styles.metricCard}>
              <span>Failed Payments</span>
              <strong>{failedPayments}</strong>
              <small>Checkout attempts requiring attention</small>
            </article>
            <article className={styles.metricCard}>
              <span>Verification Queue</span>
              <strong>{pendingVerification}</strong>
              <small>Submitted or correction-required bookings</small>
            </article>
            <article className={styles.metricCard}>
              <span>Most Requested Gadget</span>
              <strong>{popularProduct?.[0] ?? "—"}</strong>
              <small>{popularProduct ? `${popularProduct[1]} booking request(s)` : "No booking data yet"}</small>
            </article>
            <article className={styles.metricCard}>
              <span>Active Bookings</span>
              <strong>{activeBookings}</strong>
              <Link href="/admin/bookings">Manage open bookings</Link>
            </article>
            <article className={styles.metricCard}>
              <span>Catalog Products</span>
              <strong>{data.products.length}</strong>
              <small>Active and inactive catalog records</small>
            </article>
            <article className={styles.metricCard}>
              <span>Completed Rentals</span>
              <strong>{completedRentals}</strong>
              <small>Recorded rental history</small>
            </article>
          </section>

          <section className={styles.panel} aria-labelledby="recent-bookings-heading">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="recent-bookings-heading">Recent Booking Activity</h2>
                <p>Latest booking requests across all customer accounts.</p>
              </div>
              <Link href="/admin/bookings">View all bookings</Link>
            </div>

            {recentBookings.length ? (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Booking</th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          <Link href={`/admin/bookings/${booking.id}`}>
                            {booking.bookingRef}
                          </Link>
                        </td>
                        <td>{usersById.get(booking.userId)?.displayName ?? "Customer"}</td>
                        <td>{booking.productSnapshot.name}</td>
                        <td>
                          <StatusBadge status={booking.status} />
                        </td>
                        <td>{formatDate(booking.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>No booking activity has been recorded yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
