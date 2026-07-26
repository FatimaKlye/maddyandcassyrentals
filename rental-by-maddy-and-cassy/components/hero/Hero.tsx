import Link from "next/link";
import ProductShowcase from "@/components/product-showcase/ProductShowcase";
import Stats from "@/components/stats/Stats";
import CalendarIcon from "@/components/icons/CalendarIcon";
import { getActiveProducts } from "@/src/services/productService";
import styles from "./Hero.module.css";

export default async function Hero() {
  const products = await getActiveProducts();

  return (
    <section id="top" className={styles.hero} aria-label="Introduction">
      <div className={styles.backgroundGlow} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.content}>
          <p className={styles.label}>PREMIUM RENTALS · METRO MANILA</p>

          <h1 className={styles.heading}>
            Rent the Gear.
            <br />
            Create the
            <br />
            Moment.
          </h1>

          <p className={styles.description}>
            Premium cameras and iPhones for daily rental. Quality equipment,
            simple booking, and transparent pricing—all in one place.
          </p>

          <div className={styles.buttons}>
            <Link href="/catalog" className={styles.primaryButton}>
              <CalendarIcon size={18} />
              Check Availability
            </Link>
            <a href="#about" className={styles.secondaryButton}>
              How Renting Works
            </a>
          </div>

          <Stats />
        </div>

        <ProductShowcase products={products.slice(0, 2)} />
      </div>
    </section>
  );
}
