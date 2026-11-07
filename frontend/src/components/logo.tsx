import Link from "next/link";

/** A tiny ledger page: ruled lines with the double margin. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="khata-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e07a3f" />
          <stop offset="1" stopColor="#b8481f" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#khata-mark)" />
      <path d="M9.5 6v20M11.5 6v20" stroke="#fff" strokeWidth="1.2" opacity="0.55" />
      <path d="M15 12h10M15 17h10M15 22h7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight">
      <LogoMark />
      Khata
    </Link>
  );
}
