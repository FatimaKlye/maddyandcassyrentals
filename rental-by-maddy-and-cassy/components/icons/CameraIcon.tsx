interface CameraIconProps {
  size?: number;
  className?: string;
}

export default function CameraIcon({ size = 20, className }: CameraIconProps) {
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
      <path
        d="M4 8.5C4 7.67157 4.67157 7 5.5 7H7.5L8.5 5H15.5L16.5 7H18.5C19.3284 7 20 7.67157 20 8.5V17.5C20 18.3284 19.3284 19 18.5 19H5.5C4.67157 19 4 18.3284 4 17.5V8.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="13"
        r="3.4"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
