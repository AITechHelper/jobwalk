import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { clients, projectMembers, projects } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import ProjectsHub from "@/components/projects/ProjectsHub";

// My Projects — the full projects list (reached from the nav drawer).
export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const db = getDb();

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      siteAddress: projects.siteAddress,
      jobType: projects.jobType,
      createdAt: projects.createdAt,
      role: projectMembers.role,
      clientName: clients.name,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projectMembers.contractorId, contractor.id))
    .orderBy(desc(projects.createdAt));

  const clientRows = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.contractorId, contractor.id))
    .orderBy(desc(clients.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ProjectsHub
        projects={rows.map((r) => ({
          id: r.id,
          name: r.name,
          siteAddress: r.siteAddress,
          jobType: r.jobType,
          role: r.role,
          clientName: r.clientName,
        }))}
        clients={clientRows}
      />
    </div>
  );
}
