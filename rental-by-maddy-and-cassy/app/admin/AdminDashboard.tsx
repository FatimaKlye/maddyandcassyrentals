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

interface DashboardData {
  users: UserProfile[];
  bookings: Booking[];
  products: Product[];
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

    Promise.all([getAllUsers(), getAllBookings(), getAllProducts()])
      .then(([users, bookings, products]) => {
        if (active) setData({ users, bookings, products });
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
              <span>Active Bookings</span>
              <strong>{activeBookings}</strong>
              <small>Currently open requests and rentals</small>
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
                        <td>{booking.bookingRef}</td>
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
