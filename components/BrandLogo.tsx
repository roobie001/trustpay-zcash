import Link from "next/link";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function TrustPayLogo({ className = "h-8 w-8 sm:h-9 sm:w-9" }: LogoProps) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-xl border border-slate-800/90 bg-gradient-to-b from-slate-900 to-[#030712] p-1.5 shadow-md shadow-amber-500/5 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="goldGradient" x1="6" y1="8" x2="30" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>
          <linearGradient id="emeraldGradient" x1="14" y1="14" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id="vaultGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#EAB308" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Outer Vault Hexagonal Shield Boundary */}
        <path
          d="M18 3L30 8.5V19.5C30 25.5 24.5 30.5 18 33C11.5 30.5 6 25.5 6 19.5V8.5L18 3Z"
          stroke="#334155"
          strokeWidth="1.25"
          strokeLinejoin="round"
          className="opacity-70"
        />

        {/* Dual-Link Escrow Bridge: Left Link (Buyer) */}
        <path
          d="M12.5 14.5C10.5 14.5 9 16.2 9 18.5C9 20.8 10.5 22.5 12.5 22.5H16.5"
          stroke="#94A3B8"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Dual-Link Escrow Bridge: Right Link (Seller) */}
        <path
          d="M23.5 14.5C25.5 14.5 27 16.2 27 18.5C27 20.8 25.5 22.5 23.5 22.5H19.5"
          stroke="#94A3B8"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Geometric T-Bar (Horizontal Vault Beam) */}
        <path
          d="M9 10.5H27"
          stroke="url(#goldGradient)"
          strokeWidth="2.75"
          strokeLinecap="round"
          filter="url(#vaultGlow)"
        />

        {/* Geometric T-Stem (Vertical Escrow Lock Shaft) */}
        <path
          d="M18 10.5V26"
          stroke="url(#goldGradient)"
          strokeWidth="2.75"
          strokeLinecap="round"
        />

        {/* Center Emerald Trust Vault Node */}
        <circle cx="18" cy="18.5" r="3.25" fill="url(#emeraldGradient)" />
        <circle cx="18" cy="18.5" r="1.25" fill="#030712" />
      </svg>
    </div>
  );
}

export function BrandLockup({
  href = "/",
  subtitle = "Shielded Escrow",
}: {
  href?: string;
  subtitle?: string;
}) {
  const content = (
    <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
      <TrustPayLogo className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" />
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Trust<span className="text-amber-500">Pay</span>
        </span>
        {subtitle && (
          <span className="hidden rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-0.5 text-xs font-medium text-slate-400 sm:inline-block">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group shrink-0 transition hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
}
