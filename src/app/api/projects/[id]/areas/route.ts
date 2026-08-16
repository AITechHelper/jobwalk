import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projectAreas } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { getProjectAccess } from "@/lib/project-access";

// Add a room/area to a project. Anyone who can edit reports can manage areas.
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
  const access = await getProjectAccess(id, authed.contractor.id);
  if (!access) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!access.canEdit) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const body = (await req.json()) as { name?: unknown };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [area] = await getDb()
    .insert(projectAreas)
    .values({ projectId: id, name: body.name.trim() })
    .returning();

  return NextResponse.json({ area });
}
