"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const amount = Number(searchParams.get("amount") ?? 0);
  const item = searchParams.get("item") || "Rental item";
  const bookingRef = searchParams.get("bookingRef") || "Demo booking";
  const paymentLabel = searchParams.get("paymentLabel") || "Reservation payment";
  const requestedReturnPath = searchParams.get("returnPath") || "/account/bookings";
  const returnPath = useMemo(
    () =>
      requestedReturnPath.startsWith("/") && !requestedReturnPath.startsWith("//")
        ? requestedReturnPath
        : "/account/bookings",
    [requestedReturnPath],
  );
  const previewSuccessHref = useMemo(() => {
    const parameters = new URLSearchParams(searchParams.toString());
    parameters.set("preview", "success");
    return `/demo/paymongo?${parameters.toString()}`;
  }, [searchParams]);

  if (searchParams.get("preview") === "success") {
    return (
      <main className={styles.successPage}>
        <section className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <span className={styles.demoBadge}>DEMO PREVIEW</span>
          <h1>Payment screen completed</h1>
          <p>
            This preview did not charge an account and did not mark the booking as paid. A real
            PayMongo checkout will return automatically after the provider verifies payment.
          </p>
          <dl className={styles.successDetails}>
            <div>
              <dt>Booking</dt>
              <dd>{bookingRef}</dd>
            </div>
            <div>
              <dt>Previewed amount</dt>
              <dd>{money(amount)}</dd>
            </div>
          </dl>
          <Link href={withPaymentResult(returnPath, "demo-preview")}>
            Return to Reservation
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
        <section className={styles.paymentCard}>
          <p className={styles.eyebrow}>PAYMENT METHOD</p>
          <h1>How would you like to pay?</h1>
          <p className={styles.intro}>
            This development preview shows the hosted-checkout experience. PayMongo&apos;s live
            design and available methods may vary according to your merchant account.
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

          <Link className={styles.payButton} href={previewSuccessHref}>
            Preview Payment of {money(amount)}
          </Link>
          <Link className={styles.cancel} href={withPaymentResult(returnPath, "cancelled")}>
            Cancel and return
          </Link>
        </section>

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
            🔒 Live payments are completed on PayMongo&apos;s secure hosted checkout.
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
