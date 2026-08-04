"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  logout,
  requestEmailOtp,
  verifyEmailOtp,
} from "@/src/services/authService";
import Spinner from "@/components/ui/Spinner";
import formStyles from "@/components/ui/Form.module.css";
import styles from "../auth.module.css";

function getCustomerRedirect(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/admin") ||
    value.startsWith("/verify-email")
  ) {
    return "/catalog";
  }
  return value;
}

export default function VerifyEmailForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = useRef(false);
  const [code, setCode] = useState("");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const redirectTo = getCustomerRedirect(searchParams.get("redirect"));

  async function sendCode() {
    if (!user) return;
    setRequesting(true);
    setError(null);
    try {
      const result = await requestEmailOtp();
      if (result.alreadyVerified) {
        router.replace(redirectTo);
        return;
      }
      if (result.delivery === "preview" && result.demoCode) {
        setPreviewCode(result.demoCode);
        setDeliveryMessage(
          "Gmail delivery is not configured, so this development preview code can be used to test signup.",
        );
      } else {
        setPreviewCode(null);
        setDeliveryMessage(
          `A 6-digit code was sent to ${result.maskedEmail || "your Gmail address"}.`,
        );
      }
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The verification code could not be sent.",
      );
    } finally {
      setRequesting(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(
        `/sign-in?redirect=${encodeURIComponent(redirectTo)}`,
      );
      return;
    }
    if (user.email_confirmed_at) {
      router.replace(redirectTo);
      return;
    }
    if (!requested.current) {
      requested.current = true;
      void sendCode();
    }
    // sendCode intentionally runs once for the authenticated account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, redirectTo, router, user]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !/^\d{6}$/.test(code)) {
      setError("Enter the complete 6-digit verification code.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await verifyEmailOtp(code);
      router.replace(redirectTo);
      router.refresh();
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "The verification code could not be confirmed.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function changeAccount() {
    await logout();
    router.replace(
      `/sign-up?redirect=${encodeURIComponent(redirectTo)}`,
    );
  }

  if (loading || !user || user.email_confirmed_at) {
    return (
      <div className={styles.card}>
        <div className={styles.authLoading}>
          <Spinner size={28} label="Preparing email verification" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.eyebrow}>Secure your account</p>
      <h1 className={styles.heading}>Verify Your Email</h1>
      <p className={styles.subheading}>
        Enter the one-time code for <strong>{user.email}</strong>. The code
        expires after 10 minutes.
      </p>

      {deliveryMessage ? (
        <p className={styles.notice}>{deliveryMessage}</p>
      ) : null}
      {previewCode ? (
        <div className={styles.previewCode} aria-label="Development preview code">
          <span>DEVELOPMENT PREVIEW CODE</span>
          <strong>{previewCode}</strong>
          <small>This is never shown when Gmail delivery is configured.</small>
        </div>
      ) : null}
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={submit}>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="otp-code">
            6-digit verification code
          </label>
          <input
            id="otp-code"
            className={`${formStyles.input} ${styles.otpInput}`}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            autoFocus
          />
        </div>

        <button
          type="submit"
          className={`${formStyles.primaryButton} ${styles.submitButton}`}
          disabled={verifying || code.length !== 6}
        >
          {verifying ? "Verifying..." : "Verify & Continue"}
        </button>
      </form>

      <div className={styles.verifyActions}>
        <button type="button" onClick={() => void sendCode()} disabled={requesting}>
          {requesting ? "Sending..." : "Send a new code"}
        </button>
        <button type="button" onClick={() => void changeAccount()}>
          Use another account
        </button>
      </div>
    </div>
  );
}
