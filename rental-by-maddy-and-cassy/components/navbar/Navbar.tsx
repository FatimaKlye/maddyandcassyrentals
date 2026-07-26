"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import CameraIcon from "@/components/icons/CameraIcon";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/src/services/authService";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.push("/");
  }

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Rental by Maddy & Cassy home">
          <span className={styles.brandIcon} aria-hidden="true">
            <CameraIcon size={18} />
          </span>
          <span className={styles.brandName}>Rental by Maddy &amp; Cassy</span>
        </Link>

        <nav className={styles.links} aria-label="Primary navigation">
          <Link href="/catalog" className={styles.link}>
            Browse
          </Link>
          <Link href="/#about" className={styles.link}>
            About
          </Link>
          <Link href="/#contact" className={styles.link}>
            Contact
          </Link>
        </nav>

        <div className={styles.actions}>
          {!loading && user ? (
            <>
              <Link href="/account/bookings" className={styles.signIn}>
                {profile?.displayName ? `Hi, ${profile.displayName.split(" ")[0]}` : "My Bookings"}
              </Link>
              <button type="button" className={styles.signIn} onClick={handleSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <Link href="/sign-in" className={styles.signIn}>
              Sign In
            </Link>
          )}
          <Link href="/catalog" className={styles.cta}>
            Browse Rentals
          </Link>
        </div>
      </div>
    </header>
  );
}
