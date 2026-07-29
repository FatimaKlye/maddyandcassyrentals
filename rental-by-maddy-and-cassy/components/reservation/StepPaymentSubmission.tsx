"use client";

import type { Product } from "@/types/product";
import type { PaymentStatus } from "@/src/types/payment";
import type { ReservationDraft } from "@/src/types/reservationDraft";
import { getDayCount } from "@/src/types/reservationDraft";
import formStyles from "@/components/ui/Form.module.css";
import sharedStyles from "./StepShared.module.css";
import styles from "./StepPaymentSubmission.module.css";

function money(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface StepPaymentSubmissionProps {
  product: Product;
  draft: ReservationDraft;
  paymentStatus: PaymentStatus;
  bookingNumber?: string;
  opening: boolean;
  checking: boolean;
  error: string | null;
  onPaymentOptionChange: (option: "deposit_50" | "full") => void;
  onBack: () => void;
  onPay: () => void;
  onContinue: () => void;
}

export default function StepPaymentSubmission({
  product,
  draft,
  paymentStatus,
  bookingNumber,
  opening,
  checking,
  error,
  onPaymentOptionChange,
  onBack,
  onPay,
  onContinue,
}: StepPaymentSubmissionProps) {
  const total = product.pricePerDay * getDayCount(draft.startDate, draft.endDate);
  const dueNow = draft.paymentOption === "deposit_50" ? Math.round(total * 50) / 100 : total;
  const paid = paymentStatus === "paid" || paymentStatus === "partially_paid";

  return (
    <div className={sharedStyles.wrapper}>
      <h2 className={sharedStyles.heading}>Payment Submission</h2>
      <p className={sharedStyles.subheading}>
        Choose how much to pay now, then continue to PayMongo&apos;s secure checkout.
      </p>

      <div className={styles.guarantee}>
        <strong>Your selected rental dates are secured once PayMongo verifies your payment.</strong>
        <span>
          Paying 50% guarantees the reservation while leaving the remaining balance visible in
          your account. Paying in full settles the rental amount immediately.
        </span>
      </div>

      <fieldset className={styles.options} disabled={opening || paid}>
        <legend>Choose a payment option</legend>
        <label className={styles.option}>
          <input
            type="radio"
            name="paymentOption"
            checked={draft.paymentOption === "deposit_50"}
            onChange={() => onPaymentOptionChange("deposit_50")}
          />
          <span>
            <strong>Pay 50% to reserve</strong>
            <small>{money(Math.round(total * 50) / 100)} due now</small>
          </span>
        </label>
        <label className={styles.option}>
          <input
            type="radio"
            name="paymentOption"
            checked={draft.paymentOption === "full"}
            onChange={() => onPaymentOptionChange("full")}
          />
          <span>
            <strong>Pay in full</strong>
            <small>{money(total)} due now</small>
          </span>
        </label>
      </fieldset>

      <dl className={styles.summary}>
        <div>
          <dt>Rental total</dt>
          <dd>{money(total)}</dd>
        </div>
        <div>
          <dt>Amount due now</dt>
          <dd>{money(dueNow)}</dd>
        </div>
        <div>
          <dt>Balance after payment</dt>
          <dd>{money(Math.max(0, total - dueNow))}</dd>
        </div>
      </dl>

      {bookingNumber ? <p className={styles.reference}>Reservation: {bookingNumber}</p> : null}

      {checking ? (
        <p className={styles.notice}>Confirming the payment with PayMongo…</p>
      ) : paid ? (
        <p className={styles.success}>
          Payment verified. Your reservation is secured. Continue with your verification
          documents.
        </p>
      ) : null}

      {error ? (
        <p className={formStyles.errorText} role="alert">
          {error}
        </p>
      ) : null}

      <div className={sharedStyles.footer}>
        <button
          type="button"
          className={formStyles.secondaryButton}
          onClick={onBack}
          disabled={opening || checking || !!bookingNumber}
        >
          Back
        </button>
        {paid ? (
          <button type="button" className={formStyles.primaryButton} onClick={onContinue}>
            Continue to Verification
          </button>
        ) : (
          <button
            type="button"
            className={formStyles.primaryButton}
            onClick={onPay}
            disabled={opening || checking}
          >
            {opening ? "Opening PayMongo…" : "Pay Securely with PayMongo"}
          </button>
        )}
      </div>
    </div>
  );
}
