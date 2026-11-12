export function UsdcIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <text
        x="16"
        y="21.5"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="#fff"
        fontFamily="Arial, sans-serif"
      >
        $
      </text>
    </svg>
  );
}
