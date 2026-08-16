import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { reportComments } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadReportForMember } from "@/lib/report-access";

// Post a threaded comment on a report. Any project member can comment — this is
// where GC/client feedback lives, so it is deliberately not gated to editors.
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

  const body = (await req.json()) as { body?: unknown; parentId?: unknown };
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // A reply's parent must be a top-level comment on this same report.
  let parentId: string | null = null;
  if (typeof body.parentId === "string" && body.parentId) {
    const [parent] = await getDb()
      .select({ id: reportComments.id, parentId: reportComments.parentId })
      .from(reportComments)
      .where(eq(reportComments.id, body.parentId));
    if (parent && !parent.parentId) parentId = parent.id;
  }

  const [comment] = await getDb()
    .insert(reportComments)
    .values({
      reportId: id,
      contractorId: authed.contractor.id,
      parentId,
      authorName: authed.contractor.name,
      body: body.body.trim(),
    })
    .returning();

  return NextResponse.json({ comment });
}
