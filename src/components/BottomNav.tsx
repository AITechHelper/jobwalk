"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// To a contractor, a "job" IS the job site — the thing at /projects under the
// hood. "Record" starts a walkthrough. "Account" is a big, plain settings page.
// Three large, always-labeled tabs — easy to hit and read on a phone outdoors.
const TABS = [
  { href: "/projects", label: "Jobs", icon: "🧰", match: ["/projects"] },
  { href: "/record", label: "Record", icon: "🎙️", match: ["/record"] },
  { href: "/account", label: "Account", icon: "👤", match: ["/account"] },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-white/15 bg-navy pb-[env(safe-area-inset-bottom)] print:hidden">
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
            <span className="text-2xl leading-none" aria-hidden>
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
