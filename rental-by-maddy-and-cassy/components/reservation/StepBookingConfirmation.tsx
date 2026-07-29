import Link from "next/link";
import formStyles from "@/components/ui/Form.module.css";
import sharedStyles from "./StepShared.module.css";
import styles from "./StepPaymentSubmission.module.css";

export default function StepBookingConfirmation({
  bookingId,
  bookingNumber,
}: {
  bookingId: string;
  bookingNumber: string;
}) {
  return (
    <div className={sharedStyles.wrapper}>
      <h2 className={sharedStyles.heading}>Booking Confirmation</h2>
      <div className={styles.success}>
        Your reservation is secured and your booking information has been submitted successfully.
      </div>
      <p className={sharedStyles.subheading}>
        Booking {bookingNumber} is now with the team for document verification. Once approved,
        its status will change to Confirmed. Your PayMongo receipt, verified proof of payment, and
        booking invoice are already available in your account.
      </p>
      <div className={sharedStyles.footer}>
        <Link href="/account/payments" className={formStyles.secondaryButton}>
          Payment History
        </Link>
        <Link
          href={`/account/bookings/${bookingId}?justSubmitted=1`}
          className={formStyles.primaryButton}
        >
          View Booking &amp; Documents
        </Link>
      </div>
    </div>
  );
}
