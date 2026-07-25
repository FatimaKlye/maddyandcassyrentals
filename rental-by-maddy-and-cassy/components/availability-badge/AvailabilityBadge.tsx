import {
  getAvailabilityLabel,
  getAvailabilityLevel,
  getFullyBookedMessage,
  getUnitsAvailableText,
  getUnitsInUseText,
} from "@/lib/availability";
import styles from "./AvailabilityBadge.module.css";

interface AvailabilityBadgeProps {
  totalUnits: number;
  availableUnits: number;
  variant?: "compact" | "detailed";
  className?: string;
}

const LEVEL_CLASS = {
  available: "levelAvailable",
  limited: "levelLimited",
  full: "levelFull",
} as const;

export default function AvailabilityBadge({
  totalUnits,
  availableUnits,
  variant = "compact",
  className,
}: AvailabilityBadgeProps) {
  const level = getAvailabilityLevel(availableUnits, totalUnits);
  const label = getAvailabilityLabel(level);
  const levelClass = styles[LEVEL_CLASS[level]];

  if (variant === "compact") {
    return (
      <span className={`${styles.pill} ${levelClass} ${className ?? ""}`}>
        <span className={styles.dot} aria-hidden="true" />
        {getUnitsAvailableText(availableUnits)}
      </span>
    );
  }

  return (
    <div className={`${styles.detailed} ${className ?? ""}`}>
      <span className={`${styles.pill} ${levelClass}`}>
        <span className={styles.dot} aria-hidden="true" />
        {label}
      </span>
      <p className={styles.detailLine}>{getUnitsAvailableText(availableUnits)}</p>
      <p className={styles.detailLine}>{getUnitsInUseText(totalUnits, availableUnits)}</p>
      {level === "full" ? (
        <p className={styles.fullyBookedMessage} role="status">
          {getFullyBookedMessage(totalUnits)
            .split("\n")
            .map((line) => (
              <span key={line} className={styles.fullyBookedLine}>
                {line}
              </span>
            ))}
        </p>
      ) : null}
    </div>
  );
}
