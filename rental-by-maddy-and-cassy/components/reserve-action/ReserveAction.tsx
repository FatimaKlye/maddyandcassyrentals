"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import { getFullyBookedMessage, isFullyBooked } from "@/lib/availability";
import { useAuth } from "@/hooks/useAuth";
import styles from "./ReserveAction.module.css";

interface ReserveActionProps {
  product: Product;
  units: UnitCounts;
}

export default function ReserveAction({ product, units }: ReserveActionProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fullyBooked = isFullyBooked(units.availableUnits);

  function handleReserve() {
    const reservePath = `/catalog/${product.id}/reserve`;
    if (user) {
      router.push(reservePath);
    } else {
      router.push(`/sign-in?redirect=${encodeURIComponent(reservePath)}`);
    }
  }

  return (
    <div id="reserve" className={styles.wrapper}>
      <button
        type="button"
        className={styles.reserveButton}
        disabled={fullyBooked || loading}
        onClick={handleReserve}
      >
        {fullyBooked ? "Fully Booked" : "Reserve Now"}
      </button>

      {fullyBooked ? (
        <p className={styles.error} role="status">
          <strong>FULLY BOOKED</strong>
          <br />
          {getFullyBookedMessage(units.totalUnits)
            .split("\n")
            .map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
        </p>
      ) : (
        <p className={styles.hint}>
          You&apos;ll choose your dates, provide your details, and sign a rental agreement
          before your request is submitted for review.
        </p>
      )}
    </div>
  );
}
