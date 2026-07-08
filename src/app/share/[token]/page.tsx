import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { contractors, jobs, photos } from "@/lib/db/schema";
import type { Report } from "@/lib/claude";
import ReportView from "@/components/report/ReportView";
import SavePdfButton from "@/components/report/SavePdfButton";

// Public, unauthenticated report page — the link contractors send clients.
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const [row] = await db
    .select({ job: jobs, contractor: contractors })
    .from(jobs)
    .innerJoin(contractors, eq(jobs.contractorId, contractors.id))
    .where(eq(jobs.shareToken, token));

  if (!row || row.job.status !== "ready" || !row.job.report) notFound();

  const jobPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.jobId, row.job.id))
    .orderBy(photos.offsetSeconds);
  const photoUrls = Object.fromEntries(
    jobPhotos.map((p) => [p.id, p.blobUrl]),
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl justify-end px-4 pt-6 print:hidden">
        <SavePdfButton shareToken={token} />
      </div>
      <ReportView
        title={row.job.title}
        createdAt={row.job.createdAt}
        businessName={row.contractor.businessName}
        contractorName={row.contractor.name}
        phone={row.contractor.phone}
        report={row.job.report as Report}
        photoUrls={photoUrls}
      />
    </main>
  );
}
