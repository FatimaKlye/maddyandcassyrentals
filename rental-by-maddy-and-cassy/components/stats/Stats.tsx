import styles from "./Stats.module.css";

interface Stat {
  value: string;
  label: string;
}

const stats: Stat[] = [
  { value: "20+", label: "Rental Items" },
  { value: "1,000+", label: "Rentals" },
  { value: "4.9★", label: "Rating" },
  { value: "24/7", label: "Support" },
];

export default function Stats() {
  return (
    <dl className={styles.stats} aria-label="Business statistics">
      {stats.map((stat) => (
        <div key={stat.label} className={styles.stat}>
          <dt className={styles.value}>{stat.value}</dt>
          <dd className={styles.label}>{stat.label}</dd>
        </div>
      ))}
    </dl>
  );
}
