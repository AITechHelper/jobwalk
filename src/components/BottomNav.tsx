"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/record", label: "Record", icon: "●" },
  { href: "/jobs", label: "Jobs", icon: "≡" },
  { href: "/projects", label: "Projects", icon: "▦" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] print:hidden">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition ${
              active
                ? "text-brand"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {active && (
              <span className="absolute inset-x-0 top-0 mx-auto h-0.5 w-10 rounded-full bg-brand" />
            )}
            <span className="text-xl leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
