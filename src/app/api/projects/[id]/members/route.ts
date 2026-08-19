import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projectMembers } from "@/lib/db/schema";
import {
  getContractorByEmail,
  requireContractor,
} from "@/lib/contractor";
import { getProjectAccess } from "@/lib/project-access";

const ROLES = ["owner", "foreman", "gc", "client"] as const;

// Add another contractor to a project by their account email. Only an owner can
// manage the member list.
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
  if (access.role !== "owner") {
    return NextResponse.json(
      { error: "Only the project owner can add members" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { email?: unknown; role?: unknown };
  if (typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  const role = ROLES.includes(body.role as (typeof ROLES)[number])
    ? (body.role as (typeof ROLES)[number])
    : "foreman";

  const member = await getContractorByEmail(body.email);
  if (!member) {
    return NextResponse.json(
      {
        error:
          "No JobWalker account found for that email. They need to sign up first.",
      },
      { status: 404 },
    );
  }

  const [row] = await getDb()
    .insert(projectMembers)
    .values({ projectId: id, contractorId: member.id, role })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.contractorId],
      set: { role },
    })
    .returning();

  return NextResponse.json({
    member: { ...row, name: member.name, email: member.email },
  });
}
