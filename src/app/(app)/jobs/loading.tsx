// Shown instantly on navigation while JobsPage's DB query resolves —
// without this, the tap has no feedback until the full server round trip
// finishes, which reads as the app being frozen/unresponsive.
export default function JobsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Your jobs</h1>

      <div className="mt-4 h-12 animate-pulse rounded-lg bg-navy" />

      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-xl border border-white/10 bg-navy"
          />
        ))}
      </div>
    </div>
  );
}
