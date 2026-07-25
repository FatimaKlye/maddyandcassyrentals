interface HeartIconProps {
  size?: number;
  filled?: boolean;
  className?: string;
}

export default function HeartIcon({ size = 18, filled = false, className }: HeartIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 20.2C12 20.2 3.5 15.4 3.5 9.4C3.5 6.6 5.7 4.5 8.4 4.5C10 4.5 11.3 5.3 12 6.4C12.7 5.3 14 4.5 15.6 4.5C18.3 4.5 20.5 6.6 20.5 9.4C20.5 15.4 12 20.2 12 20.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
