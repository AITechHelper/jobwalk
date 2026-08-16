import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { projectMembers, projects } from "./db/schema";

export type ProjectRole = "owner" | "foreman" | "gc" | "client";

// owner and foreman run the job in the field, so they can create and edit
// reports. gc (general contractor) and client are attached to follow along and
// give feedback — they view reports and comment, but never edit.
export function canEditReports(role: ProjectRole): boolean {
  return role === "owner" || role === "foreman";
}

export type ProjectAccess = {
  projectId: string;
  role: ProjectRole;
  canEdit: boolean;
};

// Resolve a contractor's role on a project via project_members. Returns null
// when the contractor is not attached to the project at all — callers treat
// that as "not found" so a project never leaks across accounts.
export async function getProjectAccess(
  projectId: string,
  contractorId: string,
): Promise<ProjectAccess | null> {
  const [member] = await getDb()
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.contractorId, contractorId),
      ),
    );
  if (!member) return null;
  const role = member.role as ProjectRole;
  return { projectId, role, canEdit: canEditReports(role) };
}

// Load a project together with the caller's access. Returns null if the project
// doesn't exist or the caller isn't a member.
export async function loadProjectForMember(
  projectId: string,
  contractorId: string,
) {
  const access = await getProjectAccess(projectId, contractorId);
  if (!access) return null;
  const [project] = await getDb()
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return null;
  return { project, access };
}
