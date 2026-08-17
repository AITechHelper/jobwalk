import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
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
