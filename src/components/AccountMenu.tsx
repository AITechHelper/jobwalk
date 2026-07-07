"use client";

import { UserButton, useClerk } from "@clerk/nextjs";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

export default function AccountMenu() {
  const { signOut } = useClerk();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  return (
    <>
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Link
            label="Privacy Policy"
            labelIcon={<span aria-hidden>🔒</span>}
            href="/privacy"
          />
          <UserButton.Link
            label="Terms of Service"
            labelIcon={<span aria-hidden>📄</span>}
            href="/terms"
          />
          <UserButton.Action
            label="Delete account"
            labelIcon={<span aria-hidden>🗑️</span>}
            onClick={() => setConfirming(true)}
          />
        </UserButton.MenuItems>
      </UserButton>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy p-6 text-center">
            <h2 className="text-lg font-semibold">Delete your account?</h2>
            <p className="mt-2 text-sm text-white/60">
              This permanently deletes your account and every walkthrough,
              report, photo, and recording. This can&apos;t be undone.
            </p>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-white/15 px-4 py-3 font-semibold text-white/80 transition hover:text-white disabled:opacity-50"
              >
                Keep account
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-500/85 disabled:opacity-50"
              >
                {deleting && <Spinner />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
