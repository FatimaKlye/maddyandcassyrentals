import styles from "./QuickEstimate.module.css";

interface QuickEstimateProps {
  pricePerDay: number;
  depositAmount: number;
  currency: string;
  days: number;
}

export default function QuickEstimate({
  pricePerDay,
  depositAmount,
  currency,
  days,
}: QuickEstimateProps) {
  const subtotal = pricePerDay * days;
  const total = subtotal + depositAmount;

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
            {subtotal.toLocaleString()}
          </dd>
        </div>
        <div className={styles.row}>
          <dt>Refundable deposit</dt>
          <dd>
            {currency}
            {depositAmount.toLocaleString()}
          </dd>
        </div>
        <div className={`${styles.row} ${styles.totalRow}`}>
          <dt>Total amount</dt>
          <dd>
            {currency}
            {total.toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
