import type { BookingStatus } from "@/src/types/booking";

export interface AdminBookingAction {
  status: BookingStatus;
  label: string;
  requiresNote?: boolean;
  tone?: "default" | "danger";
}

export const ADMIN_BOOKING_ACTIONS: Record<BookingStatus, AdminBookingAction[]> = {
  submitted: [
    { status: "under_review", label: "Start Review" },
    { status: "approved", label: "Approve Booking" },
    { status: "correction_required", label: "Request Corrections", requiresNote: true },
    { status: "rejected", label: "Reject Booking", requiresNote: true, tone: "danger" },
  ],
  under_review: [
    { status: "approved", label: "Approve Booking" },
    { status: "correction_required", label: "Request Corrections", requiresNote: true },
    { status: "rejected", label: "Reject Booking", requiresNote: true, tone: "danger" },
  ],
  correction_required: [
    { status: "under_review", label: "Resume Review" },
    { status: "approved", label: "Approve Booking" },
    { status: "rejected", label: "Reject Booking", requiresNote: true, tone: "danger" },
  ],
  approved: [
    { status: "confirmed", label: "Confirm Schedule" },
    { status: "correction_required", label: "Request Corrections", requiresNote: true },
    { status: "rejected", label: "Reject Booking", requiresNote: true, tone: "danger" },
    { status: "cancelled", label: "Cancel Booking", requiresNote: true, tone: "danger" },
  ],
  confirmed: [
    { status: "ready", label: "Mark Ready for Handover" },
    { status: "cancelled", label: "Cancel Booking", requiresNote: true, tone: "danger" },
  ],
  ready: [
    { status: "active", label: "Start Rental" },
    { status: "cancelled", label: "Cancel Booking", requiresNote: true, tone: "danger" },
  ],
  active: [{ status: "completed", label: "Complete Rental" }],
  completed: [],
  cancelled: [],
  rejected: [],
};

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export async function updateAdminBookingStatus(
  bookingId: string,
  status: BookingStatus,
  note: string,
  idToken: string,
): Promise<void> {
  const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ status, note }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The booking status could not be updated."),
    );
  }
}

export async function downloadAdminBookingPdf(
  bookingId: string,
  bookingReference: string,
  idToken: string,
): Promise<void> {
  const response = await fetch(
    `/api/admin/bookings/${encodeURIComponent(bookingId)}/pdf`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "The booking PDF could not be generated."),
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `booking-${bookingReference.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
