import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import AdminBookingDetail from "./AdminBookingDetail";

export const metadata: Metadata = {
  title: "Booking Review | Rental by Maddy & Cassy Admin",
  description: "Review submitted rental information and manage the booking status.",
};

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  return (
    <AdminShell>
      <AdminBookingDetail bookingId={bookingId} />
    </AdminShell>
  );
}
