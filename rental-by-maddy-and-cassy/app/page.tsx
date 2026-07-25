import Navbar from "@/components/navbar/Navbar";
import Hero from "@/components/hero/Hero";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Navbar />
      <main>
        <Hero />
      </main>
    </div>
  );
}
