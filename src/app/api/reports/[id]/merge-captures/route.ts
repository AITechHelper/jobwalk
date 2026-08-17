import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contractors, jobs, photos, dailyReports } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadReportForMember } from "@/lib/report-access";
import {
  mergeCaptureSessions,
  type CaptureSession,
} from "@/lib/captureMerge";
import type { TranscriptSegment } from "@/lib/whisper";

// Merging calls Whisper-transcribed sessions through Claude; give it room.
export const maxDuration = 120;

// Re-merge every ready capture session linked to this report into the report's
// unified narrative + contributor attribution. Idempotent: safe to call each
// time a new session finishes. Editors only.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const { id } = await params;
  const loaded = await loadReportForMember(id, authed.contractor.id);
  if (!loaded) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  if (!loaded.access.canEdit) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const db = getDb();

  // All finished capture sessions feeding this report, with who recorded them.
  const sessionRows = await db
    .select({
      id: jobs.id,
      transcript: jobs.transcript,
      contributorName: contractors.name,
    })
    .from(jobs)
    .innerJoin(contractors, eq(jobs.contractorId, contractors.id))
    .where(and(eq(jobs.dailyReportId, id), eq(jobs.status, "ready")))
    .orderBy(asc(jobs.createdAt));

  if (sessionRows.length === 0) {
    return NextResponse.json(
      { error: "No finished capture sessions to merge yet." },
      { status: 400 },
    );
  }

  const sessions: CaptureSession[] = [];
  for (const row of sessionRows) {
    const segments = (row.transcript as TranscriptSegment[] | null) ?? [];
    const count = await db
      .select({ id: photos.id })
      .from(photos)
      .where(eq(photos.jobId, row.id));
    sessions.push({
      contributorName: row.contributorName,
      segments,
      photoCount: count.length,
    });
  }

  let merged;
  try {
    merged = await mergeCaptureSessions(sessions);
  } catch (err) {
    console.error(`[merge-captures] failed for report ${id}:`, err);
    return NextResponse.json(
      { error: "Couldn't merge the capture sessions." },
      { status: 500 },
    );
  }

  const [updated] = await db
    .update(dailyReports)
    .set({
      contributions: { ...merged, mergedAt: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(eq(dailyReports.id, id))
    .returning();

  return NextResponse.json({ report: updated, sessionCount: sessions.length });
}
