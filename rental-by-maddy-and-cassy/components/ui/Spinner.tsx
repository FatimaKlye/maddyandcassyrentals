import styles from "./Spinner.module.css";

interface SpinnerProps {
  size?: number;
  label?: string;
}

export default function Spinner({ size = 20, label = "Loading" }: SpinnerProps) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}
