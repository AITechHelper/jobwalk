"use client";

// Uses the browser's print pipeline (Print → "Save as PDF" / "Save to Files")
// so there's no server-side PDF dependency. The report is styled as a light
// sheet with @media print rules, so what prints is a clean branded document.
export default function SavePdfButton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <button
      onClick={() => window.print()}
      className={
        className ||
        "rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-brand hover:text-white"
      }
    >
      Save as PDF
    </button>
  );
}
