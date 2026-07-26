"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBookingsForUser } from "@/src/services/bookingService";
import { getUserProfile } from "@/src/services/userService";
import type { Booking, UserProfile } from "@/src/types/firebase";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/status-badge/StatusBadge";
import styles from "./userDetail.module.css";

interface UserDetailData {
  account: UserProfile;
  bookings: Booking[];
}

function formatDate(value: Booking["createdAt"] | UserProfile["createdAt"]): string {
  return value?.toDate?.().toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) ?? "—";
}

export default function AdminUserDetail({ uid }: { uid: string }) {
  const [data, setData] = useState<UserDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getUserProfile(uid), getBookingsForUser(uid)])
      .then(([account, bookings]) => {
        if (!active) return;
        if (!account) {
          setError("This user account does not exist.");
          return;
        }
        setData({ account, bookings });
      })
      .catch(() => {
        if (active) setError("This account could not be loaded. Please try again.");
      });

    return () => {
      active = false;
    };
  }, [uid]);

  if (error) {
    return (
      <div className={styles.page}>
        <Link href="/admin/users" className={styles.backLink}>
          ← Back to User Accounts
        </Link>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} label="Loading user account" />
      </div>
    );
  }

  const { account, bookings } = data;

  return (
    <div className={styles.page}>
      <Link href="/admin/users" className={styles.backLink}>
        ← Back to User Accounts
      </Link>

      <header className={styles.profileHeader}>
        <span className={styles.avatar} aria-hidden="true">
          {account.displayName?.charAt(0).toUpperCase() || "C"}
        </span>
        <div>
          <p className={styles.eyebrow}>CUSTOMER ACCOUNT</p>
          <h1>{account.displayName || "Unnamed account"}</h1>
          <p>{account.email}</p>
        </div>
        <span className={`${styles.status} ${styles[account.accountStatus]}`}>
          {account.accountStatus}
        </span>
      </header>

      <section className={styles.details} aria-labelledby="customer-details-heading">
        <h2 id="customer-details-heading">Customer Details</h2>
        <dl>
          <div>
            <dt>Phone</dt>
            <dd>{account.phoneNumber || "Not provided"}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{account.fullAddress || "Not provided"}</dd>
          </div>
          <div>
            <dt>Facebook</dt>
            <dd>{account.facebookLink || "Not provided"}</dd>
          </div>
          <div>
            <dt>Instagram</dt>
            <dd>{account.instagramLink || "Not provided"}</dd>
          </div>
          <div>
            <dt>Registered</dt>
            <dd>{formatDate(account.createdAt)}</dd>
          </div>
          <div>
            <dt>Firebase UID</dt>
            <dd className={styles.uid}>{account.uid}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.bookings} aria-labelledby="rental-history-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="rental-history-heading">Booking &amp; Rental History</h2>
            <p>{bookings.length} booking record{bookings.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        {bookings.length ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Product</th>
                  <th>Dates</th>
                  <th>Fulfillment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.bookingRef}</td>
                    <td>{booking.productSnapshot.name}</td>
                    <td>
                      {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                    </td>
                    <td className={styles.capitalize}>{booking.fulfillmentMethod}</td>
                    <td>
                      <StatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>This customer has no booking history yet.</p>
        )}
      </section>
    </div>
  );
}
