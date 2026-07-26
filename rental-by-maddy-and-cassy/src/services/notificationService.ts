import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase/config";
import type { NotificationType, UserNotification } from "@/src/types/notification";

function notificationsCollection(uid: string) {
  return collection(db, "users", uid, "notifications");
}

export function subscribeToUserNotifications(
  uid: string,
  callback: (notifications: UserNotification[]) => void
): Unsubscribe {
  const notificationsQuery = query(notificationsCollection(uid), orderBy("createdAt", "desc"));
  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        })) as UserNotification[]
      );
    },
    () => callback([])
  );
}

export async function markNotificationRead(uid: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, "users", uid, "notifications", notificationId), {
    isRead: true,
    readAt: serverTimestamp(),
  });
}

interface NotificationInput {
  recipientId: string;
  bookingId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}

/**
 * Shape of a single users/{uid}/notifications create, minus the
 * server-generated fields — used both by createNotification() (a standalone
 * write) and by callers that need to fold the same payload into an
 * already-open writeBatch (e.g. bookingSubmissionService.ts).
 */
export function buildNotificationPayload(input: NotificationInput) {
  return {
    recipientId: input.recipientId,
    ...(input.bookingId ? { bookingId: input.bookingId } : {}),
    type: input.type,
    title: input.title,
    message: input.message,
    ...(input.actionUrl ? { actionUrl: input.actionUrl } : {}),
    isRead: false,
    createdAt: serverTimestamp(),
  };
}

export async function createNotification(input: NotificationInput): Promise<void> {
  await addDoc(notificationsCollection(input.recipientId), buildNotificationPayload(input));
}

function bookingUrl(bookingId: string): string {
  return `/account/bookings/${bookingId}`;
}

export const notify = {
  bookingSubmitted: (recipientId: string, bookingId: string, productName: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "booking_submitted",
      title: "Booking request submitted",
      message: `Your reservation request for ${productName} has been submitted and is awaiting review.`,
      actionUrl: bookingUrl(bookingId),
    }),

  underReview: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "under_review",
      title: "Booking under review",
      message: "Your booking request is now being reviewed.",
      actionUrl: bookingUrl(bookingId),
    }),

  correctionRequired: (recipientId: string, bookingId: string, note?: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "correction_required",
      title: "Correction required",
      message: note ?? "Please review and correct the information you submitted.",
      actionUrl: bookingUrl(bookingId),
    }),

  bookingApproved: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "booking_approved",
      title: "Booking approved",
      message: "Your booking has been approved.",
      actionUrl: bookingUrl(bookingId),
    }),

  bookingConfirmed: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "booking_confirmed",
      title: "Booking confirmed",
      message: "Your booking is confirmed.",
      actionUrl: bookingUrl(bookingId),
    }),

  agreementReady: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "agreement_ready",
      title: "Rental agreement ready",
      message: "Your finalized rental agreement and booking confirmation are ready to view.",
      actionUrl: bookingUrl(bookingId),
    }),

  scheduleUpdated: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "schedule_updated",
      title: "Pickup/delivery schedule updated",
      message: "Your pickup or delivery schedule has been updated.",
      actionUrl: bookingUrl(bookingId),
    }),

  rentalActive: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "rental_active",
      title: "Rental now active",
      message: "Your rental period has started.",
      actionUrl: bookingUrl(bookingId),
    }),

  rentalCompleted: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "rental_completed",
      title: "Rental completed",
      message: "Your rental has been marked as completed. Thank you for renting with us!",
      actionUrl: bookingUrl(bookingId),
    }),

  bookingCancelled: (recipientId: string, bookingId: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "booking_cancelled",
      title: "Booking cancelled",
      message: "Your booking has been cancelled.",
      actionUrl: bookingUrl(bookingId),
    }),

  bookingRejected: (recipientId: string, bookingId: string, note?: string) =>
    createNotification({
      recipientId,
      bookingId,
      type: "booking_rejected",
      title: "Booking rejected",
      message: note ?? "Your booking request was not approved.",
      actionUrl: bookingUrl(bookingId),
    }),
};
