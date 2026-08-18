import { eq, inArray } from "drizzle-orm";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dailyReports, plans, projects, reportPhotos } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadProjectForMember } from "@/lib/project-access";

// Update project-level defaults (currently the default general contractor that
// pre-fills new daily reports). Editors only.
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
  const loaded = await loadProjectForMember(id, authed.contractor.id);
  if (!loaded) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!loaded.access.canEdit) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    generalContractor?: unknown;
  };

  const values: { generalContractor?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if ("generalContractor" in body) {
    values.generalContractor =
      typeof body.generalContractor === "string" &&
      body.generalContractor.trim()
        ? body.generalContractor.trim()
        : null;
  }

  const [updated] = await getDb()
    .update(projects)
    .set(values)
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json({ project: updated });
}

// Delete a project. Owner only — this is the most destructive project action.
// The DB cascade removes members, team, daily reports (+ their photos), plans,
// and progress marks; walkthroughs (jobs) survive with project_id set to null,
// reverting to standalone. We only need to clean up the blobs those cascaded
// rows leave behind (plan files + report photos).
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
  const loaded = await loadProjectForMember(id, authed.contractor.id);
  if (!loaded) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (loaded.access.role !== "owner") {
    return NextResponse.json(
      { error: "Only the project owner can delete it" },
      { status: 403 },
    );
  }

  const db = getDb();

  // Best-effort blob cleanup so deleting a project doesn't orphan plan files or
  // report photos in storage. A blob failure must not block the DB delete, so
  // gather first, then swallow errors.
  const projectPlans = await db
    .select({ blobUrl: plans.blobUrl })
    .from(plans)
    .where(eq(plans.projectId, id));
  const reportIds = (
    await db
      .select({ id: dailyReports.id })
      .from(dailyReports)
      .where(eq(dailyReports.projectId, id))
  ).map((r) => r.id);
  const photoRows =
    reportIds.length > 0
      ? await db
          .select({
            blobUrl: reportPhotos.blobUrl,
            annotatedBlobUrl: reportPhotos.annotatedBlobUrl,
          })
          .from(reportPhotos)
          .where(inArray(reportPhotos.reportId, reportIds))
      : [];
  const blobUrls = [
    ...projectPlans.map((p) => p.blobUrl),
    ...photoRows.map((p) => p.blobUrl),
    ...photoRows.map((p) => p.annotatedBlobUrl),
  ].filter((u): u is string => typeof u === "string" && u.length > 0);
  if (blobUrls.length > 0) {
    try {
      await del(blobUrls);
    } catch (err) {
      console.error(`[projects/${id}] blob cleanup failed:`, err);
    }
  }

  // Members, team, daily reports (+ photos), plans, and progress marks cascade
  // via their project_id FKs; jobs.project_id is set null.
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ ok: true });
}
