"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Primary app navigation: a slide-out drawer opened from the ☰ button in the
// header. Replaces the bottom tab bar. Account settings (edit details, sign
// out, delete, privacy, terms) live on the Account screen this links to.
const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/projects", label: "My Projects" },
  { href: "/team", label: "My Team" },
  { href: "/org", label: "My Org" },
  { href: "/record", label: "Record a walkthrough" },
];

export default function NavDrawer({
  businessName,
  email,
  initials,
}: {
  businessName: string | null;
  email: string | null;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { signOut } = useClerk();
  const close = () => setOpen(false);

  // Lock body scroll while open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg border border-white/25 bg-white/10 text-white transition active:scale-95 hover:border-brand/60"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-6 w-6"
          aria-hidden
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 print:hidden">
          {/* Backdrop */}
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/60"
          />

          {/* Panel */}
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col bg-navy pt-[env(safe-area-inset-top)] shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/20 p-4">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">
                  {businessName ?? "Your business"}
                </p>
                {email && (
                  <p className="truncate text-sm text-white/55">{email}</p>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <span aria-hidden className="text-2xl leading-none">
                  ×
                </span>
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={`rounded-xl px-4 py-3 text-lg font-semibold transition ${
                      active
                        ? "bg-brand/15 text-brand"
                        : "text-white/85 hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="my-2 border-t border-white/10" />

              <Link
                href="/account"
                onClick={close}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-lg font-semibold text-white/85 transition hover:bg-white/5"
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold"
                  >
                    {initials}
                  </span>
                  Account
                </span>
                <span aria-hidden className="text-white/40">
                  ›
                </span>
              </Link>
            </nav>

            <div className="border-t border-white/20 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <button
                onClick={() => signOut({ redirectUrl: "/sign-in" })}
                className="w-full rounded-xl px-4 py-3 text-left text-lg font-semibold text-white/85 transition hover:bg-white/5"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
