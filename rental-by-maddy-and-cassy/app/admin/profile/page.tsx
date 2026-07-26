import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import AdminProfileView from "./AdminProfileView";

export const metadata: Metadata = {
  title: "Admin Profile | Rental by Maddy & Cassy",
  description: "View the active administrator account and authorization record.",
};

export default function AdminProfilePage() {
  return (
    <AdminShell>
      <AdminProfileView />
    </AdminShell>
  );
}
