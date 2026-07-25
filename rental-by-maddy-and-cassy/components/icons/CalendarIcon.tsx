interface CalendarIconProps {
  size?: number;
  className?: string;
}

export default function CalendarIcon({ size = 18, className }: CalendarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="5.5"
        width="16"
        height="14.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 9.5H20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 3.5V6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 3.5V6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
