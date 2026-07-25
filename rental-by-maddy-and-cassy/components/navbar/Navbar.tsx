import Link from "next/link";
import CameraIcon from "@/components/icons/CameraIcon";
import styles from "./Navbar.module.css";

export default function Navbar() {
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
          <a href="#sign-in" className={styles.signIn}>
            Sign In
          </a>
          <Link href="/catalog" className={styles.cta}>
            Browse Rentals
          </Link>
        </div>
      </div>
    </header>
  );
}
