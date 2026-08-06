import {
  getAvailabilityLevel,
  getFullyBookedMessage,
  getAvailabilitySummaryText,
  getUnitsAvailableText,
  getUnitsInUseText,
} from "@/lib/availability";
import styles from "./AvailabilityBadge.module.css";

interface AvailabilityBadgeProps {
  totalUnits: number;
  availableUnits: number;
  variant?: "compact" | "detailed";
  mode?: "live" | "summary";
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
  mode = "live",
  className,
}: AvailabilityBadgeProps) {
  const effectiveAvailableUnits = mode === "summary" ? totalUnits : availableUnits;
  const level = getAvailabilityLevel(effectiveAvailableUnits, totalUnits);
  const levelClass = styles[LEVEL_CLASS[level]];
  const headlineText =
    mode === "summary"
      ? getAvailabilitySummaryText(totalUnits, totalUnits)
      : getAvailabilitySummaryText(availableUnits, totalUnits);

  if (variant === "compact") {
    return (
      <span className={`${styles.pill} ${levelClass} ${className ?? ""}`}>
        <span className={styles.dot} aria-hidden="true" />
        {headlineText}
      </span>
    );
  }

  return (
    <div className={`${styles.detailed} ${className ?? ""}`}>
      <span className={`${styles.pill} ${levelClass}`}>
        <span className={styles.dot} aria-hidden="true" />
        {headlineText}
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
