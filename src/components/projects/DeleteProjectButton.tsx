"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

// Owner-only. Deleting a project removes its reports, plans, team, and areas.
// Walkthroughs are NOT destroyed — they revert to standalone (the API sets
// their project_id to null) — so the confirm copy says exactly that.
export default function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      router.push("/projects");
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
        Delete this project
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
      <p className="text-sm text-white/80">
        Delete <span className="font-semibold">{projectName}</span>? Its daily
        reports, plans, areas, and team access are removed permanently.
        Walkthroughs are kept and revert to standalone.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white/80 disabled:opacity-50"
        >
          Keep
        </button>
        <button
          onClick={remove}
          disabled={deleting}
          className="flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500/85 disabled:opacity-50"
        >
          {deleting && <Spinner />}
          {deleting ? "Deleting…" : "Delete project"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
