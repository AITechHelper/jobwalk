import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, teamMembers } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";

// Add someone to the crew list that feeds the workforce dropdown. projectId is
// optional: null means company-wide (available on every project).
export async function POST(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }
  const contractor = authed.contractor;

  const body = (await req.json()) as {
    name?: unknown;
    trade?: unknown;
    projectId?: unknown;
  };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  let projectId: string | null = null;
  if (typeof body.projectId === "string" && body.projectId) {
    const [project] = await getDb()
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, body.projectId),
          eq(projects.contractorId, contractor.id),
        ),
      );
    if (!project) {
      return NextResponse.json({ error: "Unknown project" }, { status: 400 });
    }
    projectId = project.id;
  }

  const [member] = await getDb()
    .insert(teamMembers)
    .values({
      contractorId: contractor.id,
      projectId,
      name: body.name.trim(),
      trade:
        typeof body.trade === "string" && body.trade.trim()
          ? body.trade.trim()
          : null,
    })
    .returning();

  return NextResponse.json({ member });
}
