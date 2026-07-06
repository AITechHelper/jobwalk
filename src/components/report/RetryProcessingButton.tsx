"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RetryProcessingButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/process`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`retry failed: ${res.status}`);
      router.refresh();
    } catch {
      setError("Still failing — wait a moment and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={retry}
        disabled={busy}
        className="rounded-lg bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
      >
        {busy ? "Generating report..." : "Try again"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
