"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { sendEmailOtp } from "@/src/services/authService";
import formStyles from "@/components/ui/Form.module.css";
import styles from "../auth.module.css";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

function getCustomerRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/admin")) {
    return "/catalog";
  }
  return value;
}

export default function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const redirectTo = getCustomerRedirect(searchParams.get("redirect"));

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitting(true);
    try {
      await sendEmailOtp(values.email, {
        shouldCreateUser: true,
      });
      router.replace(
        `/verify-email?email=${encodeURIComponent(values.email)}&redirect=${encodeURIComponent(redirectTo)}&flow=sign-up`,
      );
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "We couldn't send a code to that email. Check the address and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Customer account</p>
      <h1 className={styles.heading}>Create Account</h1>
      <p className={styles.subheading}>
        Enter your email and we&apos;ll send you a 6-digit one-time code to
        create your account. Your identity documents are collected only when
        you reserve an item.
      </p>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <p className={styles.formError}>{formError}</p> : null}

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="email">
            Email address<span className={formStyles.required}>*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`${formStyles.input} ${errors.email ? formStyles.inputError : ""}`}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email ? (
            <p className={formStyles.errorText} role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className={styles.submitRow}>
          <button
            type="submit"
            className={`${formStyles.primaryButton} ${styles.submitButton}`}
            disabled={submitting}
          >
            {submitting ? "Sending code..." : "Send Code"}
          </button>
        </div>
      </form>

      <p className={styles.footer}>
        Already have an account?{" "}
        <Link
          href={`/sign-in${redirectTo !== "/catalog" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className={styles.footerLink}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
