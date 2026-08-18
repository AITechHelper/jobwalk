import { auth } from "@clerk/nextjs/server";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import {
  clients,
  contractors,
  dailyReports,
  jobs,
  projectAreas,
  projectMembers,
} from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { loadProjectForMember } from "@/lib/project-access";
import ProjectDetail from "@/components/projects/ProjectDetail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const { id } = await params;
  const loaded = await loadProjectForMember(id, contractor.id);
  if (!loaded) notFound();
  const { project, access } = loaded;

  const db = getDb();

  const [client] = project.clientId
    ? await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, project.clientId))
    : [];

  const members = await db
    .select({
      id: projectMembers.id,
      role: projectMembers.role,
      contractorId: projectMembers.contractorId,
      name: contractors.name,
      email: contractors.email,
    })
    .from(projectMembers)
    .innerJoin(contractors, eq(projectMembers.contractorId, contractors.id))
    .where(eq(projectMembers.projectId, id))
    .orderBy(asc(projectMembers.createdAt));

  const areas = await db
    .select({ id: projectAreas.id, name: projectAreas.name })
    .from(projectAreas)
    .where(eq(projectAreas.projectId, id))
    .orderBy(asc(projectAreas.createdAt));

  const reports = await db
    .select({
      id: dailyReports.id,
      reportDate: dailyReports.reportDate,
      status: dailyReports.status,
      reporterName: dailyReports.reporterName,
      assignedToName: contractors.name,
    })
    .from(dailyReports)
    .leftJoin(contractors, eq(dailyReports.assignedToId, contractors.id))
    .where(eq(dailyReports.projectId, id))
    .orderBy(desc(dailyReports.reportDate), desc(dailyReports.createdAt));

  // The walkthroughs recorded for this job — the link that was missing before,
  // so a job actually shows the recordings that belong to it.
  const walkthroughs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      status: jobs.status,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(eq(jobs.projectId, id))
    .orderBy(desc(jobs.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/dashboard" className="text-base text-white/65 hover:text-brand">
        ← All projects
      </Link>

      <ProjectDetail
        project={{
          id: project.id,
          name: project.name,
          siteAddress: project.siteAddress,
          jobType: project.jobType,
          clientName: client?.name ?? null,
          generalContractor: project.generalContractor,
          hasCoords: project.latitude != null && project.longitude != null,
        }}
        access={access}
        members={members}
        areas={areas}
        reports={reports}
        walkthroughs={walkthroughs.map((w) => ({
          id: w.id,
          title: w.title,
          status: w.status,
          createdAt: w.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
