"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginWithEmail } from "@/src/services/authService";
import formStyles from "@/components/ui/Form.module.css";
import styles from "../auth.module.css";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const redirectTo = searchParams.get("redirect") || "/account/bookings";

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitting(true);
    try {
      await loginWithEmail(values.email, values.password);
      router.replace(redirectTo);
    } catch {
      setFormError("We couldn't sign you in. Check your email and password and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Welcome back</p>
      <h1 className={styles.heading}>Sign In</h1>
      <p className={styles.subheading}>
        Sign in to reserve gear and manage your bookings.
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
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p className={formStyles.errorText} id="email-error" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="password">
            Password<span className={formStyles.required}>*</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={`${formStyles.input} ${errors.password ? formStyles.inputError : ""}`}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          {errors.password ? (
            <p className={formStyles.errorText} id="password-error" role="alert">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className={styles.submitRow}>
          <button
            type="submit"
            className={`${formStyles.primaryButton} ${styles.submitButton}`}
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>

      <p className={styles.footer}>
        Don&apos;t have an account?{" "}
        <Link
          href={`/sign-up${redirectTo !== "/account/bookings" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className={styles.footerLink}
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
