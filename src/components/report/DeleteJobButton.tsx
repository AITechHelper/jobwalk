"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      router.push("/jobs");
      router.refresh();
    } catch {
      setError("Couldn't delete — try again.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold text-white/50 transition hover:text-red-400"
      >
        Delete this walkthrough
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-white/70">Delete permanently?</p>
      <div className="flex gap-3">
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 disabled:opacity-50"
        >
          Keep
        </button>
        <button
          onClick={remove}
          disabled={deleting}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500/85 disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
