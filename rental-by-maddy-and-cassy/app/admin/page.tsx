import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import AdminDashboard from "./AdminDashboard";

export const metadata: Metadata = {
  title: "Admin Dashboard | Rental by Maddy & Cassy",
  description: "Rental operations dashboard for authorized administrators.",
};

export default function AdminPage() {
  return (
    <AdminShell>
      <AdminDashboard />
    </AdminShell>
  );
}
