import type { BookingStatus } from "@/src/types/booking";
import styles from "./StatusBadge.module.css";

const STATUS_LABELS: Record<BookingStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  correction_required: "Correction Required",
  approved: "Approved",
  confirmed: "Confirmed",
  ready: "Ready for Pickup or Delivery",
  active: "Active Rental",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_TONE: Record<BookingStatus, "green" | "yellow" | "red" | "neutral"> = {
  submitted: "neutral",
  under_review: "yellow",
  correction_required: "yellow",
  approved: "green",
  confirmed: "green",
  ready: "green",
  active: "green",
  completed: "neutral",
  cancelled: "red",
  rejected: "red",
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`${styles.badge} ${styles[STATUS_TONE[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
