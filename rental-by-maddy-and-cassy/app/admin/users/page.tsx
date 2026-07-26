import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import AdminUsersList from "./AdminUsersList";

export const metadata: Metadata = {
  title: "User Accounts | Rental by Maddy & Cassy Admin",
  description: "View customer and administrator accounts.",
};

export default function AdminUsersPage() {
  return (
    <AdminShell>
      <AdminUsersList />
    </AdminShell>
  );
}
