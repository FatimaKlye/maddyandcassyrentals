import AdminCatalogManager from "./AdminCatalogManager";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminCatalogPage() {
  return (
    <AdminShell>
      <AdminCatalogManager />
    </AdminShell>
  );
}
