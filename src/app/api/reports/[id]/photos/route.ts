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

// Save an annotated copy of a photo. The annotated image is uploaded as a NEW
// blob by the client; we store its URL plus the vector strokes (for re-editing)
// and never overwrite the original blobUrl. Editors only.
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

  const body = (await req.json().catch(() => ({}))) as {
    photoId?: unknown;
    annotatedBlobUrl?: unknown;
    annotation?: unknown;
    caption?: unknown;
  };
  if (typeof body.photoId !== "string" || !body.photoId) {
    return NextResponse.json({ error: "photoId required" }, { status: 400 });
  }

  // Two update modes: saving an annotation (needs annotatedBlobUrl), or editing
  // just the caption. Build the patch from whichever fields are present.
  const updates: Partial<typeof reportPhotos.$inferInsert> = {};
  if (typeof body.annotatedBlobUrl === "string" && body.annotatedBlobUrl) {
    updates.annotatedBlobUrl = body.annotatedBlobUrl;
    updates.annotation = body.annotation ?? null;
  }
  if (body.caption !== undefined) {
    updates.caption =
      typeof body.caption === "string" && body.caption.trim()
        ? body.caption.trim()
        : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 },
    );
  }

  const [updated] = await getDb()
    .update(reportPhotos)
    .set(updates)
    .where(and(eq(reportPhotos.id, body.photoId), eq(reportPhotos.reportId, id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  return NextResponse.json({ photo: updated });
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
