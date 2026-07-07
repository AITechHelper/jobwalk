import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contractors, jobs, photos } from "@/lib/db/schema";
import type { Report } from "@/lib/claude";
import { renderReportPdf } from "@/lib/reportPdf";

// Public — same access model as /share/[token]: anyone with the token can
// fetch the PDF, no auth required. Rendering (font shaping, remote photo
// fetches) can take a few seconds for a report with several photos.
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = getDb();

  const [row] = await db
    .select({ job: jobs, contractor: contractors })
    .from(jobs)
    .innerJoin(contractors, eq(jobs.contractorId, contractors.id))
    .where(eq(jobs.shareToken, token));

  if (!row || row.job.status !== "ready" || !row.job.report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const jobPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.jobId, row.job.id));
  const photoUrls = Object.fromEntries(
    jobPhotos.map((p) => [p.id, p.blobUrl]),
  );

  const pdf = await renderReportPdf({
    title: row.job.title,
    createdAt: row.job.createdAt,
    businessName: row.contractor.businessName,
    contractorName: row.contractor.name,
    phone: row.contractor.phone,
    report: row.job.report as Report,
    photoUrls,
  });

  const filename = `${row.job.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60) || "report"}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
