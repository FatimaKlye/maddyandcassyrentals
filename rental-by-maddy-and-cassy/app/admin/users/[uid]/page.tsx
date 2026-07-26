import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import AdminUserDetail from "./AdminUserDetail";

export const metadata: Metadata = {
  title: "User Account | Rental by Maddy & Cassy Admin",
  description: "View a customer account and rental history.",
};

interface AdminUserPageProps {
  params: Promise<{ uid: string }>;
}

export default async function AdminUserPage({ params }: AdminUserPageProps) {
  const { uid } = await params;

  return (
    <AdminShell>
      <AdminUserDetail uid={uid} />
    </AdminShell>
  );
}
