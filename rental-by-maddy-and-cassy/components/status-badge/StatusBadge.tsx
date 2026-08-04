import type { BookingStatus } from "@/src/types/booking";
import styles from "./StatusBadge.module.css";

const STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  pending: "Pending Review",
  approved: "Approved",
  confirmed: "Confirmed",
  ready_for_release: "Ready for Release",
  released: "Released to Customer",
  returned: "Returned / Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_TONE: Record<BookingStatus, "green" | "yellow" | "red" | "neutral"> = {
  draft: "neutral",
  pending: "yellow",
  approved: "green",
  confirmed: "green",
  ready_for_release: "green",
  released: "green",
  returned: "neutral",
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
