import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";
import RequireAdmin from "@/components/route-guards/RequireAdmin";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Admin Account | Rental by Maddy & Cassy",
  description: "Verified administrator access for Rental by Maddy & Cassy.",
};

export default function AdminPage() {
  return (
    <div>
      <Navbar />
      <RequireAdmin>
        <main className={styles.main}>
          <section className={styles.card} aria-labelledby="admin-heading">
            <p className={styles.eyebrow}>ADMINISTRATOR ACCOUNT</p>
            <h1 id="admin-heading" className={styles.heading}>
              Admin access confirmed
            </h1>
            <p className={styles.description}>
              This account is authorized for the rental business. Administrative
              management tools can be added here as each scoped workflow is completed.
            </p>
            <div className={styles.actions}>
              <Link href="/catalog" className={styles.primaryAction}>
                Review Product Catalog
              </Link>
              <Link href="/" className={styles.secondaryAction}>
                Return to Home
              </Link>
            </div>
          </section>
        </main>
      </RequireAdmin>
    </div>
  );
}
