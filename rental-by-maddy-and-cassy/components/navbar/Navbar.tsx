"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/src/services/authService";
import styles from "./Navbar.module.css";

const navigationLinks = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Browse" },
  { href: "/#about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const { user, profile, isAdmin } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await logout();
    setMenuOpen(false);
    router.push("/");
  }

  const displayName = profile?.displayName ?? user?.displayName ?? "Account";
  const firstName = displayName.split(" ")[0];
  const accountHomeHref = isAdmin ? "/admin" : "/account/bookings";
  const accountHomeLabel = isAdmin ? "Admin Dashboard" : "My Bookings";
  const profileHref = isAdmin ? "/admin/profile" : "/account/profile";
  const profileLabel = isAdmin ? "Admin Profile" : "My Profile";

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Rental by Maddy & Cassy home">
          <span className={styles.brandIcon}>
            <Image
              src="/images/maddy-cassy-rentals-logo.png"
              alt=""
              width={44}
              height={44}
              className={styles.logoImage}
              priority
            />
          </span>
          <span className={styles.brandName}>Rental by Maddy &amp; Cassy</span>
        </Link>

        <nav className={styles.links} aria-label="Primary navigation">
          {navigationLinks.map((item) => (
            <Link key={item.href} href={item.href} className={styles.link}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          {user ? (
            <>
              <Link href={accountHomeHref} className={styles.accountLink}>
                {accountHomeLabel}
              </Link>
              <details className={styles.profileMenu}>
                <summary className={styles.profileTrigger}>Hi, {firstName}</summary>
                <div className={styles.profileDropdown}>
                  <Link href={profileHref} className={styles.profileMenuLink}>
                    {profileLabel}
                  </Link>
                  <button
                    type="button"
                    className={styles.profileMenuButton}
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/sign-in" className={styles.accountLink}>
                Customer Login
              </Link>
              <Link href="/admin/sign-in" className={styles.adminLink}>
                Admin Login
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen ? (
        <div id="mobile-navigation" className={styles.mobileMenu}>
          <nav className={styles.mobileLinks} aria-label="Mobile navigation">
            {navigationLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={styles.mobileLink}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.mobileActions}>
            {user ? (
              <>
                <Link
                  href={accountHomeHref}
                  className={styles.mobileAccountLink}
                  onClick={() => setMenuOpen(false)}
                >
                  {accountHomeLabel}
                </Link>
                <Link
                  href={profileHref}
                  className={styles.mobileAccountLink}
                  onClick={() => setMenuOpen(false)}
                >
                  {profileLabel}
                </Link>
                <button type="button" className={styles.mobileTextButton} onClick={handleSignOut}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={styles.mobileAccountLink}
                  onClick={() => setMenuOpen(false)}
                >
                  Customer Login
                </Link>
                <Link
                  href="/admin/sign-in"
                  className={styles.mobileAdminLink}
                  onClick={() => setMenuOpen(false)}
                >
                  Admin Login
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
