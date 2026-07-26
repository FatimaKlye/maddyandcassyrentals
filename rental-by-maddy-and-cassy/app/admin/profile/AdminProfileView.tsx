"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAdminProfile } from "@/src/services/adminService";
import type { Admin } from "@/src/types/admin";
import Spinner from "@/components/ui/Spinner";
import styles from "./profile.module.css";

function formatDate(value: Admin["createdAt"] | Admin["updatedAt"]): string {
  return value?.toDate?.().toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) ?? "—";
}

export default function AdminProfileView() {
  const { user, profile } = useAuth();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    getAdminProfile(user.uid)
      .then((record) => {
        if (!active) return;
        setAdmin(record);
        setLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setError("The administrator profile could not be loaded.");
        setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [user]);

  if (!loaded) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} label="Loading administrator profile" />
      </div>
    );
  }

  if (error || !admin) {
    return <div className={styles.error}>{error ?? "Administrator record not found."}</div>;
  }

  const displayName =
    admin.displayName ?? profile?.displayName ?? user?.displayName ?? "Administrator";
  const email = admin.email ?? profile?.email ?? user?.email ?? "Not available";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>ADMINISTRATOR ACCOUNT</p>
        <h1>Admin Profile</h1>
        <p>Your verified administrator identity and Firebase authorization record.</p>
      </header>

      <section className={styles.card} aria-labelledby="admin-name">
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2 id="admin-name">{displayName}</h2>
            <p>{email}</p>
          </div>
          <span className={`${styles.status} ${admin.active ? styles.active : styles.inactive}`}>
            {admin.active ? "Active Administrator" : "Inactive Administrator"}
          </span>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>Account Type</dt>
            <dd>Administrator</dd>
          </div>
          <div>
            <dt>Firebase UID</dt>
            <dd className={styles.uid}>{admin.id}</dd>
          </div>
          <div>
            <dt>Admin Access Created</dt>
            <dd>{formatDate(admin.createdAt)}</dd>
          </div>
          <div>
            <dt>Last Authorization Update</dt>
            <dd>{formatDate(admin.updatedAt)}</dd>
          </div>
        </dl>

        <p className={styles.note}>
          Administrator access is controlled by the protected <code>admins/{admin.id}</code>{" "}
          Firestore record and cannot be changed from the customer account interface.
        </p>
      </section>
    </div>
  );
}
