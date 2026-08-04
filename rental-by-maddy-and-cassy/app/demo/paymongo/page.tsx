"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import styles from "./paymongoDemo.module.css";

const METHODS = [
  { id: "gcash", name: "GCash", description: "Continue with your GCash wallet" },
  { id: "maya", name: "Maya", description: "Continue with your Maya wallet" },
  { id: "qrph", name: "QR Ph", description: "Scan using a supported banking app" },
  { id: "card", name: "Credit or debit card", description: "Visa or Mastercard" },
] as const;

function money(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function withPaymentResult(returnPath: string, result: string): string {
  const separator = returnPath.includes("?") ? "&" : "?";
  return `${returnPath}${separator}payment=${result}`;
}

function DemoCheckout() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = Number(searchParams.get("amount") ?? 0);
  const item = searchParams.get("item") || "Rental item";
  const bookingRef = searchParams.get("bookingRef") || "Demo booking";
  const paymentLabel = searchParams.get("paymentLabel") || "Reservation payment";
  const sessionId = searchParams.get("sessionId") || "";
  const requestedReturnPath = searchParams.get("returnPath") || "/account/bookings";
  const returnPath = useMemo(
    () =>
      requestedReturnPath.startsWith("/") && !requestedReturnPath.startsWith("//")
        ? requestedReturnPath
        : "/account/bookings",
    [requestedReturnPath],
  );

  async function handleDemoPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !sessionId || submitting) return;
    const form = new FormData(event.currentTarget);
    const paymentMethod = String(form.get("method") ?? "gcash");
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/demo/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, paymentMethod }),
      });
      const body = (await response.json().catch(() => null)) as
        | { success?: unknown; error?: unknown }
        | null;
      if (!response.ok || body?.success !== true) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "The demo payment could not be completed.",
        );
      }
      setCompleted(true);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "The demo payment could not be completed.",
      );
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <main className={styles.successPage}>
        <section className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <span className={styles.demoBadge}>DEMO PAYMENT</span>
          <h1>Demo payment completed</h1>
          <p>
            No account was charged. This test booking is now marked with a demo payment so you can
            continue through verification documents, agreement signing, and confirmation.
          </p>
          <dl className={styles.successDetails}>
            <div>
              <dt>Booking</dt>
              <dd>{bookingRef}</dd>
            </div>
            <div>
              <dt>Simulated amount</dt>
              <dd>{money(amount)}</dd>
            </div>
          </dl>
          <Link href={withPaymentResult(returnPath, "success")}>
            Continue Booking Flow
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandMark}>M&amp;C</div>
        <div>
          <strong>Rental by Maddy &amp; Cassy</strong>
          <span>Secure PayMongo checkout preview</span>
        </div>
        <span className={styles.demoBadge}>NO REAL CHARGE</span>
      </header>

      <div className={styles.layout}>
        <form className={styles.paymentCard} onSubmit={handleDemoPayment}>
          <p className={styles.eyebrow}>PAYMENT METHOD</p>
          <h1>How would you like to pay?</h1>
          <p className={styles.intro}>
            This development preview shows the hosted-checkout experience. PayMongo&apos;s live
            design and available methods may vary according to your merchant account. Completing
            this screen records a clearly labeled demo payment for end-to-end testing.
          </p>

          <div className={styles.methods}>
            {METHODS.map((method) => (
              <label key={method.id} className={styles.method}>
                <input
                  type="radio"
                  name="method"
                  value={method.id}
                  defaultChecked={method.id === "gcash"}
                />
                <span className={styles.methodIcon}>{method.name.slice(0, 2)}</span>
                <span>
                  <strong>{method.name}</strong>
                  <small>{method.description}</small>
                </span>
              </label>
            ))}
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          <button
            type="submit"
            className={styles.payButton}
            disabled={authLoading || !user || !sessionId || submitting}
          >
            {submitting
              ? "Completing Demo Payment…"
              : !sessionId
                ? "Open This Preview from a Reservation"
                : !user
                  ? "Sign In to Complete Demo Payment"
                  : `Complete Demo Payment of ${money(amount)}`}
          </button>
          <Link className={styles.cancel} href={withPaymentResult(returnPath, "cancelled")}>
            Cancel and return
          </Link>
        </form>

        <aside className={styles.summaryCard}>
          <p className={styles.eyebrow}>ORDER SUMMARY</p>
          <h2>{item}</h2>
          <dl>
            <div>
              <dt>Booking reference</dt>
              <dd>{bookingRef}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{paymentLabel}</dd>
            </div>
            <div className={styles.total}>
              <dt>Total due now</dt>
              <dd>{money(amount)}</dd>
            </div>
          </dl>
          <p className={styles.securityNote}>
            Secure live payments are completed on PayMongo&apos;s hosted checkout. This local
            screen never processes real money.
          </p>
        </aside>
      </div>
    </main>
  );
}

export default function PayMongoDemoPage() {
  return (
    <Suspense fallback={null}>
      <DemoCheckout />
    </Suspense>
  );
}
