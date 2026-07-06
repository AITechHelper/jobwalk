"use client";

import { useState } from "react";

export default function ShareLinkButton({
  shareToken,
}: {
  shareToken: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/share/${shareToken}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Walkthrough report", url });
        return;
      } catch {
        // user cancelled the share sheet — fall through to copy
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={share}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/85"
    >
      {copied ? "Link copied!" : "Share report"}
    </button>
  );
}
