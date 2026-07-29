import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/src/lib/firebase/admin";
import type { BookingStatus } from "@/src/types/booking";
import { sendPushNotification } from "@/src/lib/server/pushNotifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  submitted: ["under_review", "correction_required", "approved", "rejected"],
  under_review: ["correction_required", "approved", "rejected"],
  correction_required: ["under_review", "approved", "rejected"],
  approved: ["correction_required", "rejected", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["active", "cancelled"],
  active: ["completed"],
  completed: [],
  cancelled: [],
  rejected: [],
};

const STATUS_COPY: Record<
  BookingStatus,
  { title: string; message: string; notificationType: string }
> = {
  submitted: {
    title: "Booking submitted",
    message: "Your booking request has been submitted.",
    notificationType: "booking_submitted",
  },
  under_review: {
    title: "Booking under review",
    message: "Your booking request is now being reviewed.",
    notificationType: "under_review",
  },
  correction_required: {
    title: "Booking update required",
    message: "Please review the administrator's notes and update your booking.",
    notificationType: "correction_required",
  },
  approved: {
    title: "Booking approved",
    message: "Your booking request has been approved.",
    notificationType: "booking_approved",
  },
  confirmed: {
    title: "Booking confirmed",
    message: "Your rental schedule has been confirmed.",
    notificationType: "booking_confirmed",
  },
  ready: {
    title: "Rental ready",
    message: "Your rental is ready for pickup or delivery.",
    notificationType: "schedule_updated",
  },
  active: {
    title: "Rental active",
    message: "Your rental has been marked as active.",
    notificationType: "rental_active",
  },
  completed: {
    title: "Rental completed",
    message: "Your rental has been marked as completed.",
    notificationType: "rental_completed",
  },
  cancelled: {
    title: "Booking cancelled",
    message: "Your booking has been cancelled.",
    notificationType: "booking_cancelled",
  },
  rejected: {
    title: "Booking rejected",
    message: "Your booking request was not approved.",
    notificationType: "booking_rejected",
  },
};

const NOTE_REQUIRED = new Set<BookingStatus>([
  "correction_required",
  "cancelled",
  "rejected",
]);

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && value in TRANSITIONS;
}

function getDateKeys(startDateKey: unknown, endDateKey: unknown): string[] {
  if (
    typeof startDateKey !== "string" ||
    typeof endDateKey !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDateKey) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDateKey)
  ) {
    return [];
  }

  const keys: string[] = [];
  const current = new Date(`${startDateKey}T00:00:00+08:00`);
  const end = new Date(`${endDateKey}T00:00:00+08:00`);

  while (current.getTime() <= end.getTime() && keys.length <= 365) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(current);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) break;
    keys.push(`${year}-${month}-${day}`);
    current.setTime(current.getTime() + 24 * 60 * 60 * 1000);
  }

  return keys;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const token = getBearerToken(request);
  if (!token) return errorResponse("Administrator authentication is required.", 401);

  const { bookingId } = await params;
  if (!bookingId || bookingId.length > 150) {
    return errorResponse("The selected booking is invalid.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The booking action could not be read.", 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse("The booking action is invalid.", 400);
  }

  const targetStatus = (body as { status?: unknown }).status;
  const rawNote = (body as { note?: unknown }).note;

  if (!isBookingStatus(targetStatus)) {
    return errorResponse("Choose a valid booking action.", 400);
  }

  const note = typeof rawNote === "string" ? rawNote.trim() : "";
  if (note.length > 1000) {
    return errorResponse("Administrator notes must be 1,000 characters or fewer.", 400);
  }
  if (NOTE_REQUIRED.has(targetStatus) && !note) {
    return errorResponse("Administrator notes are required for this action.", 400);
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    let adminUid: string;
    try {
      adminUid = (await adminAuth.verifyIdToken(token)).uid;
    } catch {
      return errorResponse("Your administrator session is invalid or expired.", 401);
    }

    const adminSnapshot = await adminDb.collection("admins").doc(adminUid).get();
    if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
      return errorResponse("Active administrator access is required.", 403);
    }

    const bookingRef = adminDb.collection("bookings").doc(bookingId);

    await adminDb.runTransaction(async (transaction) => {
      const requirementsRef = bookingRef.collection("requirements").doc("main");
      const agreementRef = bookingRef.collection("agreement").doc("main");
      const [bookingSnapshot, requirementsSnapshot, agreementSnapshot] =
        await transaction.getAll(bookingRef, requirementsRef, agreementRef);

      if (!bookingSnapshot.exists) {
        throw new Error("BOOKING_NOT_FOUND");
      }

      const booking = bookingSnapshot.data();
      const currentStatus = booking?.status;
      if (!isBookingStatus(currentStatus)) {
        throw new Error("INVALID_CURRENT_STATUS");
      }
      if (!TRANSITIONS[currentStatus].includes(targetStatus)) {
        throw new Error("INVALID_TRANSITION");
      }
      if (
        targetStatus === "approved" &&
        (
          !requirementsSnapshot.exists ||
          requirementsSnapshot.data()?.status !== "verified" ||
          !agreementSnapshot.exists ||
          !["submitted_for_review", "awaiting_admin_signature"].includes(
            agreementSnapshot.data()?.status,
          )
        )
      ) {
        throw new Error("INCOMPLETE_SUBMISSION");
      }

      const userId = typeof booking?.userId === "string" ? booking.userId : "";
      const userRef = userId ? adminDb.collection("users").doc(userId) : null;
      const userSnapshot = userRef ? await transaction.get(userRef) : null;

      const now = Timestamp.now();
      const updates: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: now,
        reviewedBy: adminUid,
        reviewedAt: now,
        adminRemarks: note || FieldValue.delete(),
      };

      if (targetStatus === "under_review") {
        updates.requirementsStatus = "submitted";
        updates.agreementStatus = "submitted_for_review";
      } else if (targetStatus === "correction_required") {
        updates.requirementsStatus = "correction_required";
        updates.agreementStatus = "correction_required";
      } else if (targetStatus === "approved") {
        updates.requirementsStatus = "verified";
        updates.agreementStatus = "awaiting_admin_signature";
        updates.paymentStatus =
          booking?.paymentStatus === "paid" ? "paid" : "unpaid";
      }

      transaction.update(bookingRef, updates);

      if (
        requirementsSnapshot.exists &&
        ["under_review", "correction_required", "approved"].includes(targetStatus)
      ) {
        transaction.update(requirementsRef, {
          status:
            targetStatus === "approved"
              ? "verified"
              : targetStatus === "correction_required"
                ? "correction_required"
                : "submitted",
          correctionNotes:
            targetStatus === "correction_required"
              ? note
              : FieldValue.delete(),
          updatedAt: now,
        });
      }

      if (
        agreementSnapshot.exists &&
        ["under_review", "correction_required", "approved"].includes(targetStatus)
      ) {
        transaction.update(agreementRef, {
          status:
            targetStatus === "approved"
              ? "awaiting_admin_signature"
              : targetStatus === "correction_required"
                ? "correction_required"
                : "submitted_for_review",
          ...(targetStatus === "approved"
            ? {
                adminTypedName:
                  adminSnapshot.data()?.displayName ??
                  adminSnapshot.data()?.email ??
                  "Rental by Maddy & Cassy",
                adminSignedAt: now,
              }
            : {}),
          updatedAt: now,
        });
      }

      const historyRef = bookingRef.collection("statusHistory").doc();
      transaction.create(historyRef, {
        previousStatus: currentStatus,
        newStatus: targetStatus,
        changedBy: "admin",
        changedByUserId: adminUid,
        message: note || STATUS_COPY[targetStatus].message,
        createdAt: now,
      });

      if (userRef && userSnapshot?.exists) {
        const notificationRef = userRef.collection("notifications").doc();
        transaction.create(notificationRef, {
          recipientId: userId,
          bookingId,
          type: STATUS_COPY[targetStatus].notificationType,
          title: STATUS_COPY[targetStatus].title,
          message: note
            ? `${STATUS_COPY[targetStatus].message} Note: ${note}`
            : STATUS_COPY[targetStatus].message,
          actionUrl: `/account/bookings/${bookingId}`,
          isRead: false,
          createdAt: now,
        });
      }

      transaction.create(adminDb.collection("auditLogs").doc(), {
        action: "booking.status_changed",
        actorType: "admin",
        actorId: adminUid,
        bookingId,
        targetType: "booking",
        targetId: bookingId,
        metadata: {
          previousStatus: currentStatus,
          newStatus: targetStatus,
          note,
        },
        createdAt: now,
      });

      const unitId =
        typeof booking?.assignedUnitId === "string" ? booking.assignedUnitId : "";
      const dateKeys = getDateKeys(booking?.startDateKey, booking?.endDateKey);

      if (unitId && dateKeys.length) {
        for (const dateKey of dateKeys) {
          const calendarRef = adminDb
            .collection("inventoryUnits")
            .doc(unitId)
            .collection("calendar")
            .doc(dateKey);

          if (targetStatus === "cancelled" || targetStatus === "rejected") {
            transaction.delete(calendarRef);
          } else if (
            targetStatus === "approved" ||
            targetStatus === "confirmed" ||
            targetStatus === "active"
          ) {
            transaction.update(calendarRef, {
              status: targetStatus === "active" ? "active" : "confirmed",
              updatedAt: now,
            });
          }
        }
      }
    });

    const updatedBooking = await adminDb.collection("bookings").doc(bookingId).get();
    const pushUserId = updatedBooking.data()?.userId;
    if (typeof pushUserId === "string") {
      await sendPushNotification({
        userId: pushUserId,
        title: STATUS_COPY[targetStatus].title,
        body: note || STATUS_COPY[targetStatus].message,
        actionUrl: `/account/bookings/${bookingId}`,
      }).catch((pushError) => console.error("Booking push notification failed", pushError));
    }

    return NextResponse.json({ success: true, bookingId, status: targetStatus });
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
      return errorResponse("The selected booking no longer exists.", 404);
    }
    if (error instanceof Error && error.message === "INVALID_TRANSITION") {
      return errorResponse("That action is not available for the booking's current status.", 409);
    }
    if (error instanceof Error && error.message === "INVALID_CURRENT_STATUS") {
      return errorResponse("The booking has an unsupported status.", 409);
    }
    if (error instanceof Error && error.message === "INCOMPLETE_SUBMISSION") {
      return errorResponse(
        "The booking cannot be approved until every requirement is verified and the signed agreement is submitted.",
        409,
      );
    }

    console.error("Admin booking status update failed", error);
    return errorResponse("The booking status could not be updated. Please try again.", 500);
  }
}
