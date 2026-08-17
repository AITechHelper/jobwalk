"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Spinner from "@/components/ui/Spinner";

type PlanRow = {
  id: string;
  name: string;
  fileType: string;
  scaleLabel: string | null;
};

export default function PlansList({
  projectId,
  canEdit,
  plans,
  reportContext = null,
}: {
  projectId: string;
  canEdit: boolean;
  plans: PlanRow[];
  // When set, the list is being used to pick a plan to log progress against a
  // specific daily report; plan links carry the report context onward.
  reportContext?: { id: string; label: string } | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suffix = reportContext ? `?report=${reportContext.id}` : "";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const result = await upload(
        `plans/${projectId}/${Date.now()}-${file.name}`,
        file,
        { access: "public", handleUploadUrl: "/api/upload" },
      );
      const res = await fetch(`/api/projects/${projectId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name.replace(/\.[^.]+$/, ""),
          blobUrl: result.url,
          fileType: isPdf ? "pdf" : "image",
        }),
      });
      if (!res.ok) throw new Error();
      const { plan } = await res.json();
      router.push(`/projects/${projectId}/plans/${plan.id}${suffix}`);
    } catch {
      setError("Upload failed. Try a PDF or image file.");
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-5">
      {reportContext && (
        <p className="mb-3 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">
          Pick a plan to mark progress for {reportContext.label}&apos;s report.
        </p>
      )}
      {canEdit && (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-navy/50 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Upload a plan (PDF or image)
          </span>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => onFile(e.target.files?.[0])}
              disabled={uploading}
              className="text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            {uploading && <Spinner className="h-4 w-4" />}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {plans.length === 0 ? (
        <p className="mt-6 text-sm text-white/40">No plans uploaded yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${projectId}/plans/${p.id}${suffix}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-navy/50 px-4 py-3 transition hover:border-brand/50"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-white/50">
                  {p.scaleLabel ? p.scaleLabel : "No scale set"} ·{" "}
                  {p.fileType.toUpperCase()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
