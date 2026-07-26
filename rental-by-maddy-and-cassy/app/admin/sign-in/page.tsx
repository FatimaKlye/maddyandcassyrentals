import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/navbar/Navbar";
import AdminSignInForm from "./AdminSignInForm";
import styles from "../../(auth)/auth.module.css";

export const metadata: Metadata = {
  title: "Admin Login | Rental by Maddy & Cassy",
  description: "Secure administrator access for rental operations.",
};

export default function AdminSignInPage() {
  return (
    <div>
      <Navbar />
      <main className={styles.main}>
        <Suspense fallback={null}>
          <AdminSignInForm />
        </Suspense>
      </main>
    </div>
  );
}
