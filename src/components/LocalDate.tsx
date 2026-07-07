"use client";

import { useSyncExternalStore } from "react";

const FORMATS = {
  short: { month: "short", day: "numeric", year: "numeric" },
  long: { year: "numeric", month: "long", day: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

// Returns false during SSR + the first client render, then true once hydrated —
// the standard way to safely render a client-only value without a hydration
// mismatch.
const noop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

// Renders a date in the viewer's local timezone. Server components format in
// UTC (Vercel's runtime clock), which can show tomorrow's date late in the
// evening. Before hydration we format in explicit UTC so server and client
// agree; after hydration we reformat with the device timezone.
export default function LocalDate({
  iso,
  format = "short",
}: {
  iso: string;
  format?: keyof typeof FORMATS;
}) {
  const hydrated = useHydrated();
  const text = new Date(iso).toLocaleDateString(
    "en-US",
    hydrated ? FORMATS[format] : { ...FORMATS[format], timeZone: "UTC" },
  );

  return <span suppressHydrationWarning>{text}</span>;
}
