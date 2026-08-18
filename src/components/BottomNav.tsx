"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Three large, always-labeled tabs — easy to hit and read on a phone outdoors.
// Home is the dashboard (business info + projects). Record starts a walkthrough.
// Account is a big, plain settings page. Icons are simple line glyphs (no
// emoji) so the bar reads as a professional tool, not a toy.
type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function RecordIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="9" y="2.5" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3.5" />
    </svg>
  );
}

function AccountIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

const TABS = [
  { href: "/dashboard", label: "Home", Icon: HomeIcon, match: ["/dashboard", "/projects"] },
  { href: "/record", label: "Record", Icon: RecordIcon, match: ["/record"] },
  { href: "/account", label: "Account", Icon: AccountIcon, match: ["/account"] },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-white/30 bg-navy pb-[env(safe-area-inset-bottom)] print:hidden">
      {TABS.map((tab) => {
        const active = tab.match.some(
          (m) => pathname === m || pathname.startsWith(`${m}/`),
        );
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 py-3.5 text-base font-semibold transition ${
              active ? "text-brand" : "text-white/70 hover:text-white"
            }`}
          >
            {active && (
              <span className="absolute inset-x-0 top-0 mx-auto h-1 w-12 rounded-full bg-brand" />
            )}
            <tab.Icon className="h-7 w-7" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
