"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import {
  getAllPaymentRecords,
  getPaymentEvents,
} from "@/src/services/operationsService";
import type { PaymentEventLog, PaymentRecord } from "@/src/types/payment";
import styles from "../operations.module.css";

function money(value: number) {
  return `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<{
    payments: PaymentRecord[];
    events: PaymentEventLog[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAllPaymentRecords(), getPaymentEvents()])
      .then(([payments, events]) => setData({ payments, events }))
      .catch(() => setError("Payment activity could not be loaded."));
  }, []);

  const payments = useMemo(
    () =>
      [...(data?.payments ?? [])].sort(
        (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
      ),
    [data],
  );
  const paidRevenue = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p>PAYMONGO OPERATIONS</p><h1>Payments &amp; Webhooks</h1><span>Reconcile checkout attempts, verified transactions, and delivery events.</span></div>
      </header>
      {error ? <div className={styles.error}>{error}</div> : null}
      {!data && !error ? <div className={styles.loading}><Spinner size={28} label="Loading payments" /></div> : data ? (
        <>
          <section className={styles.metrics}>
            <article><span>Verified Revenue</span><strong>{money(paidRevenue)}</strong></article>
            <article><span>Successful Payments</span><strong>{payments.filter((p) => p.status === "paid").length}</strong></article>
            <article><span>Pending Checkouts</span><strong>{payments.filter((p) => p.status === "pending").length}</strong></article>
            <article><span>Webhook Events</span><strong>{data.events.length}</strong></article>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Payment Records</h2><p>Customer checkout and provider references.</p></div></div>
            <div className={styles.tableWrap}><table><thead><tr><th>Booking</th><th>Reference</th><th>Amount</th><th>Status</th><th>Method</th><th>Created</th></tr></thead><tbody>
              {payments.map((payment) => <tr key={payment.id}>
                <td><Link href={`/admin/bookings/${payment.bookingId}`}>{payment.bookingRef}</Link></td>
                <td>{payment.paymentId || payment.referenceNumber}</td>
                <td>{money(payment.amount)}</td>
                <td><span className={`${styles.pill} ${styles[payment.status]}`}>{payment.status}</span></td>
                <td>{payment.paymentMethod || "—"}</td>
                <td>{payment.createdAt?.toDate?.().toLocaleString("en-PH") ?? "—"}</td>
              </tr>)}
            </tbody></table></div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Webhook Submission Log</h2><p>Signed PayMongo events and processing outcome.</p></div></div>
            <div className={styles.tableWrap}><table><thead><tr><th>Event</th><th>Type</th><th>Mode</th><th>Status</th><th>Booking</th></tr></thead><tbody>
              {[...data.events].sort((a,b)=>(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0)).map((event) => <tr key={event.id}>
                <td>{event.id}</td><td>{event.type}</td><td>{event.livemode ? "Live" : "Test"}</td>
                <td><span className={`${styles.pill} ${styles[event.status]}`}>{event.status}</span></td>
                <td>{event.bookingId ? <Link href={`/admin/bookings/${event.bookingId}`}>{event.bookingId.slice(0,8)}</Link> : "—"}</td>
              </tr>)}
            </tbody></table></div>
          </section>
        </>
      ) : null}
    </div>
  );
}
