"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

// Big, plain-language account screen. Replaces the tiny Clerk avatar menu so
// older users get large tap targets and readable labels for every action.
export default function AccountScreen({
  name,
  businessName,
  email,
}: {
  name: string;
  businessName: string | null;
  email: string | null;
}) {
  const { signOut } = useClerk();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      await signOut({ redirectUrl: "/sign-up" });
    } catch {
      setError("Couldn't delete your account — try again.");
      setDeleting(false);
    }
  }

  const rowClasses =
    "flex w-full items-center justify-between rounded-2xl border border-white/25 bg-navy px-5 py-4 text-lg font-semibold text-white transition active:scale-[0.99] hover:border-brand/60";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-3xl font-bold">Account</h1>

      <div className="mt-5 rounded-2xl border border-white/25 bg-navy px-5 py-5">
        <p className="text-2xl font-bold">{name}</p>
        {businessName && (
          <p className="mt-1 text-lg text-white/75">{businessName}</p>
        )}
        {email && <p className="mt-1 text-base text-white/60">{email}</p>}
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <Link href="/privacy" className={rowClasses}>
          Privacy policy
          <span aria-hidden className="text-white/50">
            ›
          </span>
        </Link>
        <Link href="/terms" className={rowClasses}>
          Terms of service
          <span aria-hidden className="text-white/50">
            ›
          </span>
        </Link>
        <button
          onClick={async () => {
            setSigningOut(true);
            await signOut({ redirectUrl: "/sign-in" });
          }}
          disabled={signingOut}
          className={`${rowClasses} disabled:opacity-60`}
        >
          {signingOut ? "Signing out…" : "Sign out"}
          {signingOut && <Spinner />}
        </button>
      </div>

      <button
        onClick={() => setConfirming(true)}
        className="mt-8 w-full rounded-2xl border border-red-500/40 px-5 py-4 text-lg font-semibold text-red-400 transition active:scale-[0.99] hover:border-red-500"
      >
        Delete account
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-navy p-6 text-center">
            <h2 className="text-xl font-bold">Delete your account?</h2>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              This permanently deletes your account and every project,
              walkthrough, report, photo, and recording. This can&apos;t be
              undone.
            </p>
            {error && <p className="mt-3 text-base text-red-400">{error}</p>}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3.5 text-lg font-semibold text-white transition hover:bg-red-500/85 disabled:opacity-50"
              >
                {deleting && <Spinner />}
                {deleting ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="rounded-xl border border-white/35 px-4 py-3.5 text-lg font-semibold text-white/85 transition hover:text-white disabled:opacity-50"
              >
                Keep my account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
