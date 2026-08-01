import type { Timestamp } from "firebase/firestore";

export type NotificationType =
  | "booking_submitted"
  | "under_review"
  | "correction_required"
  | "booking_approved"
  | "booking_confirmed"
  | "agreement_ready"
  | "schedule_updated"
  | "rental_active"
  | "rental_completed"
  | "booking_cancelled"
  | "booking_rejected"
  | "payment_pending"
  | "payment_paid"
  | "requirements_reviewed"
  // Legacy value kept for backward compatibility with any existing documents.
  | "status_changed"
  | "document_ready";

export interface UserNotification {
  id: string;
  recipientId: string;
  bookingId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: Timestamp;
  readAt?: Timestamp;
}
