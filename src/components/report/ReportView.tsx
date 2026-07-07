import { reportNotes, type Report } from "@/lib/claude";
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
  const notes = reportNotes(report);

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

          <section className="mt-9">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-brand">
              Notes
            </h2>
            <ol className="mt-4 flex flex-col">
              {notes.map((note, i) => (
                <li
                  key={i}
                  className="flex gap-4 break-inside-avoid border-t border-neutral-200 py-5 first:border-0 first:pt-0"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-relaxed text-neutral-800">
                      {note.text}
                    </p>
                    {note.photoIds.length > 0 && (
                      <div className="mt-3 flex flex-col gap-3">
                        {note.photoIds.map((photoId) =>
                          photoUrls[photoId] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={photoId}
                              src={photoUrls[photoId]}
                              alt={`Note ${i + 1}`}
                              className="w-full break-inside-avoid rounded-lg border border-neutral-200"
                            />
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

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
