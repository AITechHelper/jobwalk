"use client";

import { useEffect } from "react";

// Triggers the print dialog once the page is opened in a real browser (via
// SavePdfButton's Browser.open in the native app) so the flow stays a single
// tap instead of requiring the user to hit Save as PDF a second time.
export default function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [enabled]);

  return null;
}
