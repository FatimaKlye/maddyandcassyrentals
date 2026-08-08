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

const bookingSteps = [
  ["01", "Choose your gear", "Browse the catalog, compare daily rates, and open the item you want to rent."],
  ["02", "Set your reservation", "Select one or more rental days, then choose pickup or delivery."],
  ["03", "Secure your booking", "Pay either 50% or the full amount through the secure PayMongo checkout."],
  ["04", "Submit verification", "Upload the required customer and emergency-contact documents."],
  ["05", "Sign the agreement", "Review the generated rental terms and add your electronic signature."],
  ["06", "Receive confirmation", "Follow the confirmed booking, receipt, payment history, and invoice in your account."],
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
            <h2 id="about-heading" className={styles.heading}>The story behind Maddy &amp; Cassy</h2>
            <p className={styles.description}>
              IOS Rental by Maddy &amp; Cassy was built from the ground up through
              hard work, careful planning, and a genuine love for helping people
              capture the moments that matter most.
            </p>
          </div>

          <div className={styles.foundersGrid} aria-label="Founders">
            <article className={styles.founderCard}>
              <div className={styles.founderTopline}>
                <span className={styles.founderAvatar} aria-hidden="true">KC</span>
                <span className={styles.founderRole}>Owner &amp; Founder</span>
              </div>
              <h3>Kyla Concepcion</h3>
              <span className={styles.founderPet}>Maddy’s person</span>
              <p>
                Kyla built Rental by Maddy &amp; Cassy from an idea into a working
                business, drawing on her love of traveling and attending concerts
                to shape a service that helps others hold onto their favorite moments.
              </p>
            </article>

            <article className={styles.founderCard}>
              <div className={styles.founderTopline}>
                <span className={styles.founderAvatar} aria-hidden="true">KR</span>
                <span className={styles.founderRole}>Co-Owner</span>
              </div>
              <h3>Kim Antonette Repalda</h3>
              <span className={styles.founderPet}>Cassy’s person</span>
              <p>
                Kim is Kyla&apos;s best friend and co-owner, working alongside her
                to research the rental industry and put in place the policies and
                processes that keep every booking clear and secure.
              </p>
            </article>
          </div>

          <div className={styles.storyGrid}>
            <details className={styles.storyBlock} open>
              <summary>
                <span className={styles.storyNumber}>01</span>
                <h3>The Story Behind Our Name</h3>
                <span className={styles.storyToggle} aria-hidden="true">+</span>
              </summary>
              <div className={styles.storyBody}>
                <p>
                  Maddy &amp; Cassy comes from our pets — Kyla&apos;s dog, Maddy, and
                  Kim&apos;s cat, Cassy. It&apos;s also a nod to Maddy and Cassie,
                  Kyla&apos;s two favorite characters from <em>Euphoria</em>.
                </p>
              </div>
            </details>

            <details className={styles.storyBlock}>
              <summary>
                <span className={styles.storyNumber}>02</span>
                <h3>Why We Started</h3>
                <span className={styles.storyToggle} aria-hidden="true">+</span>
              </summary>
              <div className={styles.storyBody}>
                <p>
                  Kyla&apos;s love for traveling and attending concerts showed her
                  how much a quality camera or phone matters for preserving
                  once-in-a-lifetime moments. Not everyone can justify buying an
                  expensive gadget for occasional use, so we built a way to make
                  premium devices accessible for trips, concerts, content creation,
                  and special occasions.
                </p>
              </div>
            </details>

            <details className={styles.storyBlock}>
              <summary>
                <span className={styles.storyNumber}>03</span>
                <h3>Our Mission</h3>
                <span className={styles.storyToggle} aria-hidden="true">+</span>
              </summary>
              <div className={styles.storyBody}>
                <p>
                  We&apos;re here for travelers, concertgoers, content creators, and
                  anyone chasing a memorable moment — giving them access to reliable,
                  high-quality devices so they can capture it without compromise.
                </p>
              </div>
            </details>
          </div>

          <div className={styles.aboutCta}>
            <p>Ready to capture your next memory?</p>
            <Link href="/catalog" className={styles.ctaButton}>Browse the Catalog</Link>
          </div>
        </section>

        <section id="how-it-works" className={styles.howItWorks} aria-labelledby="how-it-works-heading">
          <div className={styles.aboutIntro}>
            <p className={styles.eyebrow}>HOW IT WORKS</p>
            <h2 id="how-it-works-heading" className={styles.heading}>One clear path from browsing to confirmation.</h2>
            <p className={styles.description}>
              Every booking follows the same six-step process, so you always know
              what is complete and what comes next.
            </p>
          </div>

          <div className={styles.steps} aria-label="How renting works">
            {bookingSteps.map(([number, title, description]) => (
              <article key={number} className={styles.step}>
                <span className={styles.stepNumber}>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.guideSection} aria-labelledby="rental-guide-heading">
          <div className={styles.guideIntro}>
            <p className={styles.eyebrow}>BEFORE YOU RENT</p>
            <h2 id="rental-guide-heading" className={styles.heading}>Everything you need for a smooth rental.</h2>
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
