import type { BookingStatus } from "@/src/types/booking";
import styles from "./StatusBadge.module.css";

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending Review",
  approved: "Approved",
  confirmed: "Confirmed",
  released: "Released to Customer",
  returned: "Returned / Completed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<BookingStatus, "green" | "yellow" | "red" | "neutral"> = {
  pending: "yellow",
  approved: "green",
  confirmed: "green",
  released: "green",
  returned: "neutral",
  cancelled: "red",
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`${styles.badge} ${styles[STATUS_TONE[status]]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
