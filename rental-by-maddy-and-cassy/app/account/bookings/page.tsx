"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/src/lib/supabase/client";
import { getBookingsForUser } from "@/src/services/bookingService";
import type { Booking } from "@/src/types/booking";
import BookingSummaryCard from "@/components/booking-summary/BookingSummaryCard";
import StatusBadge from "@/components/status-badge/StatusBadge";
import Spinner from "@/components/ui/Spinner";
import {
  COMPLETED_RENTALS_BEFORE_REWARD,
  LOYALTY_REWARD_RENTAL_NUMBER,
} from "@/src/lib/promotions";
import styles from "./bookings.module.css";

export default function BookingsListPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useEffect(() => {
    if (!user) return;
    getBookingsForUser(createClient(), user.id).then(setBookings);
  }, [user]);

  const completedRentals = bookings?.filter((booking) => booking.status === "returned").length ?? 0;
  const loyaltyRewardBooking = bookings?.find(
    (booking) => booking.loyaltyDiscountAmount > 0 && booking.status !== "cancelled",
  );
  const progressPercent = Math.min(
    100,
    (completedRentals / COMPLETED_RENTALS_BEFORE_REWARD) * 100,
  );

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>My Bookings</h1>

      {bookings !== null ? (
        <section className={styles.loyalty} aria-labelledby="loyalty-heading">
          <div className={styles.loyaltyTopline}>
            <div>
              <p>SPECIAL PERK</p>
              <h2 id="loyalty-heading">Your loyalty reward progress</h2>
            </div>
            <strong>{completedRentals} completed</strong>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Completed rentals toward loyalty reward"
            aria-valuemin={0}
            aria-valuemax={COMPLETED_RENTALS_BEFORE_REWARD}
            aria-valuenow={Math.min(completedRentals, COMPLETED_RENTALS_BEFORE_REWARD)}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.loyaltyCopy}>
            <span>
              {loyaltyRewardBooking
                ? `₱200 loyalty reward applied to ${loyaltyRewardBooking.bookingRef}.`
                : completedRentals >= COMPLETED_RENTALS_BEFORE_REWARD
                  ? `Reward unlocked—₱200 will be applied automatically to rental #${LOYALTY_REWARD_RENTAL_NUMBER}.`
                  : `${COMPLETED_RENTALS_BEFORE_REWARD - completedRentals} more completed ${COMPLETED_RENTALS_BEFORE_REWARD - completedRentals === 1 ? "rental" : "rentals"} to unlock ₱200 off.`}
            </span>
            <small>Same customer account • One returned booking equals one count • No card required</small>
          </div>
        </section>
      ) : null}

      {bookings === null ? (
        <div className={styles.loading}>
          <Spinner label="Loading your bookings" />
        </div>
      ) : bookings.length === 0 ? (
        <div className={styles.empty}>
          <p>You haven&apos;t made any booking requests yet.</p>
          <Link href="/catalog" className={styles.browseLink}>
            Browse Rentals
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link href={`/account/bookings/${booking.id}`} className={styles.cardLink}>
                <BookingSummaryCard
                  bookingRef={booking.bookingRef}
                  productName={booking.productSnapshot.name}
                  brand={booking.productSnapshot.brand}
                  productImage={booking.productSnapshot.image}
                  pricePerDay={booking.productSnapshot.pricePerDay}
                  currency={booking.productSnapshot.currency}
                  startDate={new Date(booking.startDate)}
                  endDate={new Date(booking.endDate)}
                  dayCount={booking.dayCount}
                  quantity={booking.quantity}
                  fulfillmentMethod={booking.fulfillmentMethod}
                  customerLocation={booking.location ?? ""}
                  statusSlot={<StatusBadge status={booking.status} />}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
