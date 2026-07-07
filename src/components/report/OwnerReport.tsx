"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reportNotes, type Report } from "@/lib/claude";
import ReportView from "./ReportView";
import ShareLinkButton from "./ShareLinkButton";
import SavePdfButton from "./SavePdfButton";
import Spinner from "@/components/ui/Spinner";

type Props = {
  jobId: string;
  shareToken: string;
  title: string;
  createdAt: Date;
  businessName: string;
  contractorName: string;
  phone: string;
  report: Report;
  photoUrls: Record<string, string>;
};

export default function OwnerReport({
  jobId,
  shareToken,
  title,
  createdAt,
  businessName,
  contractorName,
  phone,
  report,
  photoUrls,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft state — only initialized/reset when entering edit mode.
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSummary, setDraftSummary] = useState(report.summary);
  const [draftNotes, setDraftNotes] = useState(() =>
    reportNotes(report).map((n) => ({ text: n.text, photoIds: n.photoIds })),
  );
  const [draftRecs, setDraftRecs] = useState<string[]>(report.recommendations);

  function startEditing() {
    setDraftTitle(title);
    setDraftSummary(report.summary);
    setDraftNotes(
      reportNotes(report).map((n) => ({ text: n.text, photoIds: n.photoIds })),
    );
    setDraftRecs(report.recommendations);
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!draftTitle.trim()) {
      setError("Give the report a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          report: {
            summary: draftSummary,
            notes: draftNotes.map((n) => ({
              text: n.text,
              photoIds: n.photoIds,
            })),
            recommendations: draftRecs
              .map((r) => r.trim())
              .filter(Boolean),
          },
        }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

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
      setConfirmDelete(false);
    }
  }

  const inputClasses =
    "w-full rounded-lg border border-white/10 bg-navy px-3 py-2 text-foreground placeholder-white/40 focus:border-brand focus:outline-none";

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-end gap-2 bg-background/90 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
          >
            {saving && <Spinner />}
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Title
          </span>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className={`mt-1 ${inputClasses}`}
          />
        </label>

        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Summary
          </span>
          <textarea
            value={draftSummary}
            onChange={(e) => setDraftSummary(e.target.value)}
            rows={4}
            className={`mt-1 ${inputClasses}`}
          />
        </label>

        <div className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/50">
          Notes
        </div>
        {draftNotes.map((note, i) => (
          <div
            key={i}
            className="mt-3 flex gap-3 rounded-xl border border-white/10 bg-navy/50 p-4"
          >
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <textarea
                value={note.text}
                onChange={(e) =>
                  setDraftNotes((prev) =>
                    prev.map((n, j) =>
                      j === i ? { ...n, text: e.target.value } : n,
                    ),
                  )
                }
                rows={3}
                placeholder="What was observed"
                className={inputClasses}
              />
              {note.photoIds.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {note.photoIds.map((photoId) =>
                    photoUrls[photoId] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={photoId}
                        src={photoUrls[photoId]}
                        alt=""
                        className="aspect-square w-full rounded-md border border-white/10 object-cover"
                      />
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="mt-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Recommended next steps
          </span>
          <div className="mt-2 flex flex-col gap-2">
            {draftRecs.map((rec, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={rec}
                  onChange={(e) =>
                    setDraftRecs((prev) =>
                      prev.map((r, j) => (j === i ? e.target.value : r)),
                    )
                  }
                  className={inputClasses}
                />
                <button
                  onClick={() =>
                    setDraftRecs((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label="Remove step"
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-white/50 transition hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => setDraftRecs((prev) => [...prev, ""])}
              className="self-start text-sm font-semibold text-brand hover:text-brand/80"
            >
              + Add step
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2 px-4 pt-6 print:hidden">
        <button
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete report"
          className="mr-auto rounded-lg px-2 py-2 text-sm font-medium text-white/40 transition hover:text-red-400"
        >
          Delete
        </button>
        <button
          onClick={startEditing}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-brand hover:text-white"
        >
          Edit
        </button>
        <SavePdfButton />
        <ShareLinkButton shareToken={shareToken} />
      </div>

      {error && (
        <p className="mx-auto max-w-2xl px-4 pt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <ReportView
        title={title}
        createdAt={createdAt}
        businessName={businessName}
        contractorName={contractorName}
        phone={phone}
        report={report}
        photoUrls={photoUrls}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy p-6 text-center">
            <h2 className="text-lg font-semibold">Delete this report?</h2>
            <p className="mt-2 text-sm text-white/60">
              This permanently removes the walkthrough, its recording, and
              photos. This can&apos;t be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-white/15 px-4 py-3 font-semibold text-white/80 transition hover:text-white disabled:opacity-50"
              >
                Keep
              </button>
              <button
                onClick={remove}
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
    </div>
  );
}
