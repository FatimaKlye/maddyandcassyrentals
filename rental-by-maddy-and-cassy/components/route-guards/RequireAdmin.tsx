"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Spinner from "@/components/ui/Spinner";
import styles from "./RequireAuth.module.css";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace(`/admin/sign-in?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAdmin, loading, pathname, router, user]);

  if (loading || !user || !isAdmin) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} label="Checking administrator access" />
      </div>
    );
  }

  return <>{children}</>;
}
