import styles from "./QuickEstimate.module.css";

interface QuickEstimateProps {
  pricePerDay: number;
  currency: string;
  days: number;
}

export default function QuickEstimate({ pricePerDay, currency, days }: QuickEstimateProps) {
  const estimatedRentalAmount = pricePerDay * days;

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>Quick Estimate</h3>
      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>
            {currency}
            {pricePerDay.toLocaleString()} × {days} {days === 1 ? "day" : "days"}
          </dt>
          <dd>
            {currency}
            {estimatedRentalAmount.toLocaleString()}
          </dd>
        </div>
        <div className={`${styles.row} ${styles.totalRow}`}>
          <dt>Estimated rental amount</dt>
          <dd>
            {currency}
            {estimatedRentalAmount.toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
