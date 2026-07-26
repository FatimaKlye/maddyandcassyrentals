import styles from "./ReservationStepper.module.css";

interface ReservationStepperProps {
  steps: string[];
  currentStep: number;
}

export default function ReservationStepper({ steps, currentStep }: ReservationStepperProps) {
  return (
    <ol className={styles.stepper} aria-label="Reservation progress">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <li
            key={label}
            className={`${styles.step} ${isCurrent ? styles.current : ""} ${
              isCompleted ? styles.completed : ""
            }`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className={styles.indicator} aria-hidden="true">
              {isCompleted ? "✓" : stepNumber}
            </span>
            <span className={styles.label}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
