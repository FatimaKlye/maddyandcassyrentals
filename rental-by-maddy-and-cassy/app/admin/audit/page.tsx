"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Spinner from "@/components/ui/Spinner";
import { getAuditLogs, type AuditLog } from "@/src/services/operationsService";
import styles from "../operations.module.css";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAuditLogs().then(setLogs).catch(() => setError("Audit history could not be loaded."));
  }, []);
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return [...(logs ?? [])]
      .filter((log) => !query || `${log.action} ${log.actorId} ${log.targetType} ${log.targetId}`.toLowerCase().includes(query))
      .sort((a,b)=>(b.createdAt?.toMillis?.()??0)-(a.createdAt?.toMillis?.()??0));
  }, [logs, filter]);
  return (
    <div className={styles.page}>
      <header className={styles.header}><div><p>IMMUTABLE HISTORY</p><h1>Business Audit Logs</h1><span>Review booking, payment, catalog, pricing, and account actions.</span></div>
        <input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="Filter audit activity" />
      </header>
      {error ? <div className={styles.error}>{error}</div> : null}
      {!logs && !error ? <div className={styles.loading}><Spinner size={28} label="Loading audit logs" /></div> : logs ? (
        <section className={styles.panel}>
          <div className={styles.tableWrap}><table><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Booking</th><th>Date</th></tr></thead><tbody>
            {filtered.map((log)=><tr key={log.id}>
              <td><strong>{log.action}</strong></td><td>{log.actorType}: {log.actorId}</td><td>{log.targetType}: {log.targetId}</td>
              <td>{log.bookingId ? <Link href={`/admin/bookings/${log.bookingId}`}>{log.bookingId.slice(0,8)}</Link> : "—"}</td>
              <td>{log.createdAt?.toDate?.().toLocaleString("en-PH") ?? "—"}</td>
            </tr>)}
          </tbody></table></div>
        </section>
      ) : null}
    </div>
  );
}
