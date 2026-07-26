import Navbar from "@/components/navbar/Navbar";
import RequireAuth from "@/components/route-guards/RequireAuth";
import styles from "./account.module.css";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Navbar />
      <RequireAuth>
        <main className={styles.main}>{children}</main>
      </RequireAuth>
    </div>
  );
}
