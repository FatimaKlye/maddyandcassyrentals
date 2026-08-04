import type { BookingStatus } from "@/src/types/booking";

export interface AdminBookingAction {
  status: BookingStatus;
  label: string;
  requiresNote?: boolean;
  tone?: "default" | "danger";
}

export const ADMIN_BOOKING_ACTIONS: Record<BookingStatus, AdminBookingAction[]> = {
  pending: [
    { status: "approved", label: "Approve Booking" },
    { status: "cancelled", label: "Reject Booking", requiresNote: true, tone: "danger" },
  ],
  approved: [
    { status: "confirmed", label: "Confirm Booking" },
    { status: "cancelled", label: "Cancel Booking", requiresNote: true, tone: "danger" },
  ],
  confirmed: [
    { status: "released", label: "Mark Released" },
    { status: "cancelled", label: "Cancel Booking", requiresNote: true, tone: "danger" },
  ],
  released: [{ status: "returned", label: "Mark Returned" }],
  returned: [],
  cancelled: [],
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
): Promise<void> {
  const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "The booking status could not be updated."));
  }
}

export async function downloadAdminBookingPdf(bookingId: string, bookingReference: string): Promise<void> {
  const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/pdf`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "The booking PDF could not be generated."));
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
