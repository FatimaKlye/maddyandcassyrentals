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
  const paymentAvailable = ["approved", "confirmed"].includes(booking.status);

  async function handlePay() {
    if (!user) return;
    setOpening(true);
    try {
      const idToken = await user.getIdToken();
      const result = await createPaymentCheckout(booking.id, idToken);
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
        <span>Amount {paymentStatus === "paid" ? "paid" : "due"}</span>
        <strong>{money(booking.amountDue ?? booking.estimatedRentalAmount)}</strong>
      </div>

      {paymentStatus === "paid" ? (
        <p className={styles.message}>
          PayMongo verified this transaction. Your official receipt and finalized agreement are
          available under Documents.
        </p>
      ) : paymentAvailable ? (
        <>
          <p className={styles.message}>
            Continue to PayMongo&apos;s hosted checkout. Your booking is confirmed only after the
            signed webhook verifies a successful payment.
          </p>
          <button type="button" onClick={handlePay} disabled={opening}>
            {opening ? "Opening secure checkout..." : latestPayment?.status === "pending" ? "Continue Payment" : "Pay Securely"}
          </button>
        </>
      ) : (
        <p className={styles.message}>
          Payment opens after the business approves your booking and verification requirements.
        </p>
      )}

      {latestPayment?.referenceNumber ? (
        <small>Payment reference: {latestPayment.referenceNumber}</small>
      ) : null}
    </section>
  );
}
