export function AccordMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="4" fill="#0E1014" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="3.5" stroke="rgba(255,255,255,0.14)" />
      <path
        d="M9.5 22.5L16 8.5L22.5 22.5"
        stroke="#F4F2ED"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
      <path d="M11.75 18H20.25" stroke="#C5A46D" strokeWidth="1.6" />
      <rect x="14.75" y="7.25" width="2.5" height="2.5" fill="#C5A46D" />
    </svg>
  );
}

