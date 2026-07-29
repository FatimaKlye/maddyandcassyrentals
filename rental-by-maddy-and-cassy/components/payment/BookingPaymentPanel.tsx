"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/ToastProvider";
import { createPaymentCheckout } from "@/src/services/paymentService";
import type { Booking } from "@/src/types/booking";
import type { PaymentRecord } from "@/src/types/payment";
import styles from "./BookingPaymentPanel.module.css";

function money(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function BookingPaymentPanel({
  booking,
  payments,
}: {
  booking: Booking;
  payments: PaymentRecord[];
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [opening, setOpening] = useState(false);
  const latestPayment = [...payments].sort(
    (left, right) =>
      (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0),
  )[0];
  const paymentStatus = booking.paymentStatus ?? latestPayment?.status ?? "unpaid";
  const paymentAvailable = [
    "submitted",
    "under_review",
    "correction_required",
    "approved",
    "confirmed",
  ].includes(booking.status);
  const totalAmount = booking.amountDue ?? booking.estimatedRentalAmount;
  const balanceDue = booking.balanceDue ?? Math.max(0, totalAmount - (booking.amountPaid ?? 0));

  async function handlePay() {
    if (!user) return;
    setOpening(true);
    try {
      const idToken = await user.getIdToken();
      const result = await createPaymentCheckout(
        booking.id,
        idToken,
        paymentStatus === "partially_paid" ? "balance" : "full",
      );
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The payment page could not be opened.",
        "error",
      );
      setOpening(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <p>SECURE PAYMENT</p>
          <h3>{paymentStatus === "paid" ? "Payment confirmed" : "Rental payment"}</h3>
        </div>
        <span className={`${styles.status} ${styles[paymentStatus]}`}>
          {paymentStatus.replaceAll("_", " ")}
        </span>
      </div>

      <div className={styles.amountRow}>
        <span>
          {paymentStatus === "paid"
            ? "Total paid"
            : paymentStatus === "partially_paid"
              ? "Remaining balance"
              : "Rental total"}
        </span>
        <strong>{money(paymentStatus === "partially_paid" ? balanceDue : totalAmount)}</strong>
      </div>

      {paymentStatus === "paid" ? (
        <p className={styles.message}>
          PayMongo verified this transaction. Your official receipt and finalized agreement are
          available under Documents.
        </p>
      ) : paymentAvailable ? (
        <>
          <p className={styles.message}>
            Continue to PayMongo&apos;s hosted checkout. A verified payment secures your selected
            rental dates. Verification documents are completed afterward.
          </p>
          <button type="button" onClick={handlePay} disabled={opening}>
            {opening
              ? "Opening secure checkout..."
              : latestPayment?.status === "pending"
                ? "Continue Payment"
                : paymentStatus === "partially_paid"
                  ? "Pay Remaining Balance"
                  : "Pay Securely"}
          </button>
        </>
      ) : (
        <p className={styles.message}>
          Payment is unavailable because this booking is no longer active.
        </p>
      )}

      {latestPayment?.referenceNumber ? (
        <small>Payment reference: {latestPayment.referenceNumber}</small>
      ) : null}
    </section>
  );
}
