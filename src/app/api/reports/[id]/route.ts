import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  dailyReports,
  projectMembers,
  projects,
  reportPhotos,
} from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadReportForMember } from "@/lib/report-access";
import { sanitizeReportBody } from "@/lib/dailyReport";
import { isAssignable } from "@/lib/team";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  req: Request,
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

  const input = (await req.json()) as Record<string, unknown>;
  const updates: Partial<typeof dailyReports.$inferInsert> = {
    updatedAt: new Date(),
  };

  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  if (input.reportDate !== undefined) {
    if (typeof input.reportDate !== "string" || !DATE_RE.test(input.reportDate)) {
      return NextResponse.json({ error: "invalid reportDate" }, { status: 400 });
    }
    updates.reportDate = input.reportDate;
  }
  if (input.status !== undefined) {
    if (input.status !== "draft" && input.status !== "completed") {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    updates.status = input.status;
  }
  if (input.jobType !== undefined) {
    updates.jobType =
      input.jobType === "residential" ? "residential" : "commercial";
  }
  if (input.reporterName !== undefined) updates.reporterName = str(input.reporterName);
  if (input.generalContractor !== undefined)
    updates.generalContractor = str(input.generalContractor);
  if (input.reviewerName !== undefined) updates.reviewerName = str(input.reviewerName);
  if (input.body !== undefined) updates.body = sanitizeReportBody(input.body);

  // Reassign (or clear) the responsible teammate. Validated against the project
  // owner's roster; assigning also guarantees the teammate can open the report.
  if (input.assignedToId !== undefined) {
    if (input.assignedToId === null || input.assignedToId === "") {
      updates.assignedToId = null;
    } else if (typeof input.assignedToId === "string") {
      const [proj] = await getDb()
        .select({ ownerId: projects.contractorId })
        .from(projects)
        .where(eq(projects.id, loaded.report.projectId));
      if (
        !proj ||
        !(await isAssignable(proj.ownerId, input.assignedToId))
      ) {
        return NextResponse.json(
          { error: "You can only assign reports to teammates." },
          { status: 400 },
        );
      }
      updates.assignedToId = input.assignedToId;
      await getDb()
        .insert(projectMembers)
        .values({
          projectId: loaded.report.projectId,
          contractorId: input.assignedToId,
          role: "foreman",
        })
        .onConflictDoNothing();
    }
  }

  await getDb().update(dailyReports).set(updates).where(eq(dailyReports.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
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

  // Best-effort blob cleanup for attached photos before the cascade delete.
  const attached = await db
    .select({ blobUrl: reportPhotos.blobUrl })
    .from(reportPhotos)
    .where(eq(reportPhotos.reportId, id));
  const urls = attached.map((p) => p.blobUrl).filter(Boolean);
  if (urls.length > 0) {
    try {
      await del(urls);
    } catch (err) {
      console.error(`[reports/${id}] blob cleanup failed:`, err);
    }
  }

  await db.delete(dailyReports).where(eq(dailyReports.id, id));
  return NextResponse.json({ ok: true });
}
