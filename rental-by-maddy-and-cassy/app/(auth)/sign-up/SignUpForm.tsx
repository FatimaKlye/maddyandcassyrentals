"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerWithEmail } from "@/src/services/authService";
import formStyles from "@/components/ui/Form.module.css";
import styles from "../auth.module.css";

const schema = z
  .object({
    displayName: z.string().min(2, "Enter your full name"),
    email: z.string().min(1, "Email is required").email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function getCustomerRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/admin")) {
    return "/account/bookings";
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
      await registerWithEmail(values.email, values.password, values.displayName);
      router.replace(redirectTo);
    } catch {
      setFormError(
        "We couldn't create your account. That email may already be in use, or your password may be too weak."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Get started</p>
      <h1 className={styles.heading}>Create Account</h1>
      <p className={styles.subheading}>
        Create an account to reserve gear and track your bookings.
      </p>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <p className={styles.formError}>{formError}</p> : null}

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="displayName">
            Full name<span className={formStyles.required}>*</span>
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            className={`${formStyles.input} ${errors.displayName ? formStyles.inputError : ""}`}
            aria-invalid={!!errors.displayName}
            {...register("displayName")}
          />
          {errors.displayName ? (
            <p className={formStyles.errorText} role="alert">
              {errors.displayName.message}
            </p>
          ) : null}
        </div>

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

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="password">
            Password<span className={formStyles.required}>*</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={`${formStyles.input} ${errors.password ? formStyles.inputError : ""}`}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password ? (
            <p className={formStyles.errorText} role="alert">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="confirmPassword">
            Confirm password<span className={formStyles.required}>*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={`${formStyles.input} ${errors.confirmPassword ? formStyles.inputError : ""}`}
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className={formStyles.errorText} role="alert">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <div className={styles.submitRow}>
          <button
            type="submit"
            className={`${formStyles.primaryButton} ${styles.submitButton}`}
            disabled={submitting}
          >
            {submitting ? "Creating account..." : "Create Account"}
          </button>
        </div>
      </form>

      <p className={styles.footer}>
        Already have an account?{" "}
        <Link
          href={`/sign-in${redirectTo !== "/account/bookings" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
          className={styles.footerLink}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
