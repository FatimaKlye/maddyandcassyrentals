import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/navbar/Navbar";
import SignInForm from "./SignInForm";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Sign In | Rental by Maddy & Cassy",
  description: "Sign in to manage your rental reservations.",
};

export default function SignInPage() {
  return (
    <div>
      <Navbar />
      <main className={styles.main}>
        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>
      </main>
    </div>
  );
}
