import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/navbar/Navbar";
import SignUpForm from "./SignUpForm";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Create Account | Rental by Maddy & Cassy",
  description: "Create an account to reserve gear and manage your bookings.",
};

export default function SignUpPage() {
  return (
    <div>
      <Navbar />
      <main className={styles.main}>
        <Suspense fallback={null}>
          <SignUpForm />
        </Suspense>
      </main>
    </div>
  );
}
