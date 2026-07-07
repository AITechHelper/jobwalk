// Shown instantly on navigation while JobDetailPage's DB query resolves.
export default function JobDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="h-4 w-20 animate-pulse rounded bg-navy" />
      <div className="mt-6 h-40 animate-pulse rounded-2xl bg-navy" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-navy" />
        ))}
      </div>
    </div>
  );
}
