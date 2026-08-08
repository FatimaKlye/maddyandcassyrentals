"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import { useAuth } from "@/hooks/useAuth";
import styles from "./ReserveAction.module.css";

interface ReserveActionProps {
  product: Product;
  units: UnitCounts;
}

export default function ReserveAction({ product, units }: ReserveActionProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const unavailable = units.totalUnits <= 0;

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
        disabled={unavailable || loading}
        onClick={handleReserve}
      >
        {unavailable ? "Unavailable" : "Reserve Now"}
      </button>

      {unavailable ? (
        <p className={styles.error} role="status">
          This item does not currently have an active rental unit.
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
