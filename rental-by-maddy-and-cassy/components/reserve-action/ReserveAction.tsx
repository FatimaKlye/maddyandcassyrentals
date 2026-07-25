"use client";

import { useState } from "react";
import type { Product } from "@/types/product";
import type { UnitCounts } from "@/lib/availability";
import { isFullyBooked } from "@/lib/availability";
import { submitReservation } from "@/src/services/inventoryService";
import RentalDurationSelector from "@/components/rental-duration-selector/RentalDurationSelector";
import QuickEstimate from "@/components/quick-estimate/QuickEstimate";
import styles from "./ReserveAction.module.css";

interface ReserveActionProps {
  product: Product;
  units: UnitCounts;
}

export default function ReserveAction({ product, units }: ReserveActionProps) {
  const [days, setDays] = useState(1);
  const [status, setStatus] = useState<"idle" | "submitting" | "confirmed" | "error">("idle");
  const fullyBooked = isFullyBooked(units.availableUnits);

  async function handleReserve() {
    setStatus("submitting");
    try {
      await submitReservation({
        productId: product.id,
        days,
        totalPrice: product.pricePerDay * days + product.depositAmount,
        currency: product.currency,
      });
      setStatus("confirmed");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div id="reserve" className={styles.wrapper}>
      <RentalDurationSelector days={days} onChange={setDays} disabled={fullyBooked} />

      <QuickEstimate
        pricePerDay={product.pricePerDay}
        depositAmount={product.depositAmount}
        currency={product.currency}
        days={days}
      />

      <button
        type="button"
        className={styles.reserveButton}
        disabled={fullyBooked || status === "submitting"}
        onClick={handleReserve}
      >
        {fullyBooked
          ? "Fully Booked"
          : status === "submitting"
            ? "Submitting..."
            : "Reserve Now"}
      </button>

      {status === "confirmed" ? (
        <p className={styles.confirmation} role="status">
          Reservation request received for {product.name}. We&apos;ll reach out
          to confirm your dates and payment details shortly.
        </p>
      ) : status === "error" ? (
        <p className={styles.error} role="alert">
          We couldn&apos;t complete your reservation — the last unit may have
          just been taken. Please refresh and try again.
        </p>
      ) : (
        <p className={styles.hint}>
          No payment required to request a reservation — we&apos;ll confirm
          availability and next steps with you directly.
        </p>
      )}
    </div>
  );
}
