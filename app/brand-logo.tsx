import Link from "next/link";

export function BrandLogo({ href = "/" }: { href?: string }) {
  return <Link href={href} className="logo" aria-label="LST Ruta">
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false">
        <rect width="40" height="40" rx="10" fill="currentColor"/>
        <path d="M10.5 28.5 28.5 10.5M19.5 10.5h9v9" fill="none" stroke="#fff" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M11 32h12.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".88"/>
      </svg>
    </span>
    <span className="logo-name">LST <span>Ruta</span></span>
  </Link>;
}
