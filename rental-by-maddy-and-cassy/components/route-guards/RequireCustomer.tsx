"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Spinner from "@/components/ui/Spinner";
import styles from "./RequireAuth.module.css";

export default function RequireCustomer({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isAdmin) {
      router.replace("/admin");
      return;
    }

    if (!user.emailVerified) {
      router.replace(`/verify-email?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAdmin, loading, pathname, router, user]);

  if (loading || !user || isAdmin || !user.emailVerified) {
    return (
      <div className={styles.loading}>
        <Spinner size={28} label="Checking your customer account" />
      </div>
    );
  }

  return <>{children}</>;
}
