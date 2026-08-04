"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Spinner from "@/components/ui/Spinner";
import styles from "./RequireAuth.module.css";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!user.email_confirmed_at) {
      router.replace(`/verify-email?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user || !user.email_confirmed_at) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} label="Checking your session" />
      </div>
    );
  }

  return <>{children}</>;
}
