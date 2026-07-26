import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import AdminBookingsList from "./AdminBookingsList";

export const metadata: Metadata = {
  title: "Bookings | Rental by Maddy & Cassy Admin",
  description: "Review and manage customer rental booking requests.",
};

export default function AdminBookingsPage() {
  return (
    <AdminShell>
      <AdminBookingsList />
    </AdminShell>
  );
}
