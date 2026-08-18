"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import Spinner from "@/components/ui/Spinner";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Generates a real PDF server-side and hands it directly to the platform's
// native mechanism for saving/sharing a file. window.print() is unreliable on
// iOS (relies on AirPrint + a hidden pinch-to-expand gesture, and doesn't
// work at all in the Simulator), so this avoids print entirely.
export default function SavePdfButton({
  shareToken,
  className = "",
}: {
  shareToken: string;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);
    try {
      const res = await fetch(`/api/share/${shareToken}/pdf`);
      if (!res.ok) throw new Error(`pdf fetch failed: ${res.status}`);
      const blob = await res.blob();
      const filename =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? "report.pdf";

      if (Capacitor.isNativePlatform()) {
        const base64 = await blobToBase64(blob);
        const { uri } = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({ title: filename, url: uri });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[SavePdfButton] failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      className={
        className ||
        "flex items-center gap-2 rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-brand hover:text-white disabled:opacity-60"
      }
    >
      {saving && <Spinner />}
      {saving ? "Preparing..." : "Save as PDF"}
    </button>
  );
}
