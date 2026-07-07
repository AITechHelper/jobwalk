import type { Report } from "@/lib/claude";
import LocalDate from "@/components/LocalDate";

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
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      {/* A light "paper" document that reads professionally on screen and
          exports cleanly to PDF via the browser print pipeline. */}
      <article className="report-sheet overflow-hidden rounded-2xl bg-white text-neutral-800 shadow-xl ring-1 ring-black/5 print:rounded-none print:shadow-none print:ring-0">
        <header className="bg-brand px-8 py-7 text-white print:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {businessName}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{title}</h1>
          <p className="mt-3 text-sm text-white/90">
            Walkthrough Report ·{" "}
            <LocalDate iso={createdAt.toISOString()} format="long" />
          </p>
          <p className="text-sm text-white/90">
            {contractorName} · {phone}
          </p>
        </header>

        <div className="px-8 py-8 print:px-10">
          <section className="break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-brand">
              Summary
            </h2>
            <p className="mt-2 leading-relaxed text-neutral-700">
              {report.summary}
            </p>
          </section>

          {report.areas.map((area, i) => (
            <section key={i} className="mt-9">
              <h2 className="break-after-avoid border-b border-neutral-200 pb-2 text-xl font-semibold text-neutral-900">
                {area.title}
              </h2>
              <p className="mt-3 leading-relaxed text-neutral-700">
                {area.narrative}
              </p>
              {area.photoIds.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {area.photoIds.map((photoId) =>
                    photoUrls[photoId] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={photoId}
                        src={photoUrls[photoId]}
                        alt={area.title}
                        className="w-full break-inside-avoid rounded-lg border border-neutral-200 object-cover"
                      />
                    ) : null,
                  )}
                </div>
              )}
            </section>
          ))}

          {report.recommendations.length > 0 && (
            <section className="mt-9 break-inside-avoid rounded-xl border border-brand/30 bg-brand/5 p-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-brand">
                Recommended next steps
              </h2>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-neutral-700 marker:text-brand">
                {report.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="border-t border-neutral-200 px-8 py-5 text-center text-xs text-neutral-400 print:px-10">
          Prepared by {businessName} · {phone}
        </footer>
      </article>
    </div>
  );
}
