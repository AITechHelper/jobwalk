"use client";

import { useRouter } from "next/navigation";

// Privacy/Terms are reached from several places (sign-up footer, account
// menu) with no fixed parent page, so "back" means browser history rather
// than a hardcoded destination.
export default function BackLink() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-white/60 hover:text-brand"
    >
      ← Back
    </button>
  );
}
