import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reportFiles } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadReportForMember } from "@/lib/report-access";

// Attach non-photo files (PDFs, specs, submittals) — already uploaded to Blob
// by the client — to a daily report. Editors only. (STACK "Linked Documents &
// Files".)
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

  const body = (await req.json().catch(() => ({}))) as {
    files?: { url?: unknown; name?: unknown; contentType?: unknown }[];
  };
  if (!Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  const rows = body.files
    .filter((f) => typeof f.url === "string" && f.url)
    .map((f) => ({
      reportId: id,
      blobUrl: f.url as string,
      name:
        typeof f.name === "string" && f.name.trim()
          ? f.name.trim()
          : "Attachment",
      contentType:
        typeof f.contentType === "string" ? f.contentType : null,
    }));
  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid files" }, { status: 400 });
  }

  const inserted = await getDb().insert(reportFiles).values(rows).returning();
  return NextResponse.json({ files: inserted });
}

// Detach a single file (?fileId=...). Editors only. Best-effort blob cleanup.
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

  const fileId = new URL(req.url).searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .delete(reportFiles)
    .where(and(eq(reportFiles.id, fileId), eq(reportFiles.reportId, id)))
    .returning();

  if (row?.blobUrl) {
    try {
      await del(row.blobUrl);
    } catch (err) {
      console.error(`[reports/${id}/files] blob cleanup failed:`, err);
    }
  }

  return NextResponse.json({ ok: true });
}
