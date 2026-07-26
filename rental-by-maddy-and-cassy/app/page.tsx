import Link from "next/link";
import Navbar from "@/components/navbar/Navbar";
import Hero from "@/components/hero/Hero";
import styles from "./page.module.css";

const rentalGuides = [
  {
    href: "/how-to-book",
    label: "How to Book",
    description: "Follow the booking process from choosing dates to receiving your rental.",
  },
  {
    href: "/rental-requirements",
    label: "Rental Requirements",
    description: "Prepare the IDs, profiles, contact details, and agreement needed to rent.",
  },
  {
    href: "/terms",
    label: "Terms & Conditions",
    description: "Review deposits, schedules, item care, cancellations, and rental policies.",
  },
  {
    href: "/faq",
    label: "FAQs",
    description: "Find quick answers about reservations, payments, extensions, and returns.",
  },
] as const;

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

        <section className={styles.guideSection} aria-labelledby="rental-guide-heading">
          <div className={styles.guideIntro}>
            <p className={styles.eyebrow}>BEFORE YOU RENT</p>
            <h2 id="rental-guide-heading" className={styles.heading}>
              Everything you need for a smooth rental.
            </h2>
            <p className={styles.description}>
              Read the booking steps, prepare your requirements, and review the
              rental policies before sending your request.
            </p>
          </div>

          <div className={styles.guideGrid}>
            {rentalGuides.map((guide) => (
              <Link key={guide.href} href={guide.href} className={styles.guideCard}>
                <span>{guide.label}</span>
                <p>{guide.description}</p>
                <strong aria-hidden="true">Read guide →</strong>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
