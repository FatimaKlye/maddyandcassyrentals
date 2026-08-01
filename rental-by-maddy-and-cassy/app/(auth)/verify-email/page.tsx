import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/navbar/Navbar";
import VerifyEmailForm from "./VerifyEmailForm";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Verify Email | Rental by Maddy & Cassy",
  description: "Verify your customer account using a secure one-time code.",
};

export default function VerifyEmailPage() {
  return (
    <div>
      <Navbar />
      <main className={styles.main}>
        <Suspense fallback={null}>
          <VerifyEmailForm />
        </Suspense>
      </main>
    </div>
  );
}
