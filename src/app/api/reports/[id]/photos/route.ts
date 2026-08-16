import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projectAreas, reportPhotos } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadReportForMember } from "@/lib/report-access";

// Attach photos (already uploaded to Blob by the client) to a daily report,
// optionally grouped by area. Editors only.
export async function POST(
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

  const body = (await req.json()) as {
    photos?: { url?: unknown; areaId?: unknown; caption?: unknown }[];
  };
  if (!Array.isArray(body.photos) || body.photos.length === 0) {
    return NextResponse.json({ error: "photos required" }, { status: 400 });
  }

  // Only accept areaIds that belong to this project.
  const areas = await getDb()
    .select({ id: projectAreas.id })
    .from(projectAreas)
    .where(eq(projectAreas.projectId, loaded.report.projectId));
  const areaIds = new Set(areas.map((a) => a.id));

  const rows = body.photos
    .filter((p) => typeof p.url === "string" && p.url)
    .map((p) => ({
      reportId: id,
      blobUrl: p.url as string,
      areaId:
        typeof p.areaId === "string" && areaIds.has(p.areaId) ? p.areaId : null,
      caption:
        typeof p.caption === "string" && p.caption.trim()
          ? p.caption.trim()
          : null,
    }));
  if (rows.length === 0) {
    return NextResponse.json({ error: "no valid photos" }, { status: 400 });
  }

  const inserted = await getDb().insert(reportPhotos).values(rows).returning();
  return NextResponse.json({ photos: inserted });
}

// Delete a single attached photo (?photoId=...). Editors only.
export async function DELETE(
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

  const photoId = new URL(req.url).searchParams.get("photoId");
  if (!photoId) {
    return NextResponse.json({ error: "photoId required" }, { status: 400 });
  }

  await getDb()
    .delete(reportPhotos)
    .where(and(eq(reportPhotos.id, photoId), eq(reportPhotos.reportId, id)));
  return NextResponse.json({ ok: true });
}
