"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Spinner from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";
import {
  getAdminAuditLogs,
  type AdminAuditLog,
} from "@/src/services/operationsService";
import styles from "../operations.module.css";

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLog[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;

    getAdminAuditLogs()
      .then((records) => {
        if (active) setLogs(records);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Audit history could not be loaded.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (logs ?? []).filter(
      (log) =>
        !query ||
        `${log.action} ${log.actorUserId ?? ""} ${log.entityType} ${log.entityId ?? ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [logs, filter]);

  return (
    <AdminShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <p>IMMUTABLE HISTORY</p>
            <h1>Business Audit Logs</h1>
            <span>
              Review booking, payment, catalog, pricing, and account actions.
            </span>
          </div>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter audit activity"
            aria-label="Filter audit activity"
          />
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}
        {!logs && !error ? (
          <div className={styles.loading}>
            <Spinner size={28} label="Loading audit logs" />
          </div>
        ) : logs ? (
          <section className={styles.panel}>
            {filtered.length ? (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Target</th>
                      <th>Booking</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <strong>{log.action}</strong>
                        </td>
                        <td>
                          {log.actorType}: {log.actorUserId ?? "system"}
                        </td>
                        <td>
                          {log.entityType}: {log.entityId ?? "-"}
                        </td>
                        <td>
                          {log.bookingId ? (
                            <Link href={`/admin/bookings/${log.bookingId}`}>
                              {log.bookingId.slice(0, 8)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {log.createdAt
                            ? new Date(log.createdAt).toLocaleString("en-PH")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.empty}>No audit activity matches this filter.</p>
            )}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
