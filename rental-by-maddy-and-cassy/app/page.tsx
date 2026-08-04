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
            <p className={styles.eyebrow}>ABOUT US</p>
            <h2 id="about-heading" className={styles.heading}>
              The story behind Maddy &amp; Cassy
            </h2>
            <p className={styles.description}>
              IOS Rental by Maddy &amp; Cassy was built from the ground up through
              hard work, careful planning, and a genuine love for helping people
              capture the moments that matter most.
            </p>
          </div>

          <div className={styles.foundersGrid} aria-label="Founders">
            <article className={styles.founderCard}>
              <span className={styles.founderAvatar} aria-hidden="true">
                K
              </span>
              <span className={styles.founderRole}>Owner &amp; Founder</span>
              <h3>Kyla Concepcion</h3>
              <span className={styles.founderPet}>🐾 Owner of Maddy, her dog</span>
              <p>
                Kyla built Rental by Maddy &amp; Cassy from an idea into a working
                business, drawing on her love of traveling and attending concerts
                to shape a service that helps others hold onto their own favorite
                moments.
              </p>
            </article>
            <article className={styles.founderCard}>
              <span className={styles.founderAvatar} aria-hidden="true">
                K
              </span>
              <span className={styles.founderRole}>Co-Owner</span>
              <h3>Kim Antonette Repalda</h3>
              <span className={styles.founderPet}>🐈 Owner of Cassy, her cat</span>
              <p>
                Kim is Kyla&apos;s best friend and co-owner, working alongside her
                to research the rental industry and put in place the policies and
                processes that keep every booking clear and secure.
              </p>
            </article>
          </div>

          <div className={styles.storyGrid}>
            <article className={styles.storyBlock}>
              <h3>The Story Behind Our Name</h3>
              <p>
                Maddy &amp; Cassy comes from our pets — Kyla&apos;s dog, Maddy, and
                Kim&apos;s cat, Cassy. It&apos;s also a nod to Maddy and Cassie,
                Kyla&apos;s two favorite characters from <em>Euphoria</em>.
              </p>
            </article>
            <article className={styles.storyBlock}>
              <h3>Why We Started</h3>
              <p>
                Kyla&apos;s love for traveling and attending concerts showed her
                how much a quality camera or phone matters for preserving
                once-in-a-lifetime moments. Not everyone can afford or justify
                buying an expensive gadget for occasional use — so we built a way
                to make premium devices accessible for trips, concerts, content
                creation, and special occasions. Along the way, we researched the
                gadget-rental industry, identified the risks, and put clear
                policies and processes in place to protect our customers and our
                business.
              </p>
            </article>
            <article className={styles.storyBlock}>
              <h3>Our Mission</h3>
              <p>
                We&apos;re here for travelers, concertgoers, content creators, and
                anyone chasing a memorable moment — giving them access to
                reliable, high-quality devices so they can capture it without
                compromise.
              </p>
            </article>
          </div>

          <div className={styles.aboutCta}>
            <p>Ready to capture your next memory?</p>
            <Link href="/catalog" className={styles.ctaButton}>
              Browse the Catalog
            </Link>
          </div>
        </section>

        <section
          id="how-it-works"
          className={styles.howItWorks}
          aria-labelledby="how-it-works-heading"
        >
          <div className={styles.aboutIntro}>
            <p className={styles.eyebrow}>HOW IT WORKS</p>
            <h2 id="how-it-works-heading" className={styles.heading}>
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
