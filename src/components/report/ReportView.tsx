import type { Report } from "@/lib/claude";

type Props = {
  title: string;
  createdAt: Date;
  businessName: string;
  contractorName: string;
  phone: string;
  report: Report;
  photoUrls: Record<string, string>; // photoId -> blob URL
};

export default function ReportView({
  title,
  createdAt,
  businessName,
  contractorName,
  phone,
  report,
  photoUrls,
}: Props) {
  const date = createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="mx-auto max-w-2xl px-4 py-8">
      <header className="border-b border-white/10 pb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          {businessName}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-white/60">
          Walkthrough report · {date} · {contractorName} · {phone}
        </p>
      </header>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Summary</h2>
        <p className="mt-2 leading-relaxed text-white/80">{report.summary}</p>
      </section>

      {report.areas.map((area, i) => (
        <section key={i} className="mt-8">
          <h2 className="text-lg font-semibold">{area.title}</h2>
          <p className="mt-2 leading-relaxed text-white/80">{area.narrative}</p>
          {area.photoIds.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {area.photoIds.map((photoId) =>
                photoUrls[photoId] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photoId}
                    src={photoUrls[photoId]}
                    alt={area.title}
                    className="w-full rounded-lg border border-white/10 object-cover"
                  />
                ) : null,
              )}
            </div>
          )}
        </section>
      ))}

      {report.recommendations.length > 0 && (
        <section className="mt-8 rounded-xl border border-brand/40 bg-navy p-5">
          <h2 className="text-lg font-semibold">Recommended next steps</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-white/80">
            {report.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t border-white/10 pt-4 text-center text-xs text-white/40">
        Prepared by {businessName} · {phone}
      </footer>
    </article>
  );
}
