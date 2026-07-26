import Navbar from "@/components/navbar/Navbar";
import Hero from "@/components/hero/Hero";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Navbar />
      <main>
        <Hero />
        <section id="about" className={styles.about} aria-labelledby="about-heading">
          <div className={styles.aboutIntro}>
            <p className={styles.eyebrow}>ABOUT THE RENTAL SERVICE</p>
            <h2 id="about-heading" className={styles.heading}>
              Quality gear, with a clear rental process.
            </h2>
            <p className={styles.description}>
              Rental by Maddy &amp; Cassy helps customers in Metro Manila reserve
              cameras and iPhones with transparent daily rates, availability,
              requirements, and booking updates in one place.
            </p>
          </div>

          <div className={styles.steps} aria-label="How renting works">
            <article className={styles.step}>
              <span className={styles.stepNumber}>01</span>
              <h3>Choose your gear</h3>
              <p>Open the catalog, compare available items, and review the daily rate.</p>
            </article>
            <article className={styles.step}>
              <span className={styles.stepNumber}>02</span>
              <h3>Send a booking request</h3>
              <p>Select your dates, provide the rental requirements, and sign the agreement.</p>
            </article>
            <article className={styles.step}>
              <span className={styles.stepNumber}>03</span>
              <h3>Follow your booking</h3>
              <p>Check your account for approval, pickup or delivery details, and status updates.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
