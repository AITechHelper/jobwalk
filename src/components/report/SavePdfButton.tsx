"use client";

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

// Uses the browser's print pipeline (Print → "Save as PDF" / "Save to Files")
// so there's no server-side PDF dependency. The report is styled as a light
// sheet with @media print rules, so what prints is a clean branded document.
//
// window.print() is a no-op inside Capacitor's WKWebView — there's no print
// UI to trigger. In the native app, open the public share link in the system
// browser instead, where print actually works; AutoPrint on that page
// triggers it automatically so it's still a single tap.
export default function SavePdfButton({
  shareToken,
  className = "",
}: {
  shareToken: string;
  className?: string;
}) {
  async function handleClick() {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({
        url: `${window.location.origin}/share/${shareToken}?print=1`,
      });
      return;
    }
    window.print();
  }

  return (
    <button
      onClick={handleClick}
      className={
        className ||
        "rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-brand hover:text-white"
      }
    >
      Save as PDF
    </button>
  );
}
