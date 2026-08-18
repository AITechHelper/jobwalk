import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { clients, dailyReports, projectMembers, projects } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { getRoster } from "@/lib/team";
import ProjectsHub from "@/components/projects/ProjectsHub";
import TeamRoster from "@/components/TeamRoster";
import ReportsPanel from "@/components/ReportsPanel";

// The front dashboard / management hub: the contractor's business at a glance,
// their projects, their team roster, and the reports they can create, assign,
// and pick up. This is the landing screen after sign-in.
export default async function DashboardPage() {
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

  const roster = await getRoster(contractor.id);

  // Reports assigned to this user, across every project, newest first.
  const assignedToMe = await db
    .select({
      id: dailyReports.id,
      reportDate: dailyReports.reportDate,
      status: dailyReports.status,
      projectName: projects.name,
    })
    .from(dailyReports)
    .innerJoin(projects, eq(dailyReports.projectId, projects.id))
    .where(eq(dailyReports.assignedToId, contractor.id))
    .orderBy(desc(dailyReports.reportDate));

  // Projects the user can start a report on (owner/foreman = can edit).
  const editableProjects = rows
    .filter((r) => r.role === "owner" || r.role === "foreman")
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* On phones this is one column; on wide screens the cards pack into two
          balanced columns (break-inside-avoid keeps each card whole) so the hub
          fits with far less scrolling. */}
      <div className="lg:columns-2 lg:gap-5 [&>*]:mb-4 [&>*]:break-inside-avoid lg:[&>*]:mb-5">
        {/* Business overview */}
        <div className="rounded-2xl border border-white/25 bg-navy p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                {contractor.businessName}
              </h1>
              {contractor.tradeType && (
                <p className="mt-0.5 text-sm capitalize text-white/70">
                  {contractor.tradeType}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-brand/15 px-3 py-1 text-sm font-semibold text-brand">
              {rows.length} {rows.length === 1 ? "project" : "projects"}
            </span>
          </div>

          <dl className="mt-3 flex flex-col gap-1 text-sm text-white/70">
            <div className="flex gap-2">
              <dt className="text-white/45">Contact</dt>
              <dd>{contractor.name}</dd>
            </div>
            {contractor.phone && (
              <div className="flex gap-2">
                <dt className="text-white/45">Phone</dt>
                <dd>
                  <a href={`tel:${contractor.phone}`} className="hover:text-white">
                    {contractor.phone}
                  </a>
                </dd>
              </div>
            )}
            {contractor.email && (
              <div className="flex gap-2">
                <dt className="text-white/45">Email</dt>
                <dd className="break-all">{contractor.email}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Projects */}
        <div>
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

        {/* Team roster */}
        <div>
          <TeamRoster roster={roster} />
        </div>

        {/* Reports: assigned-to-me + create & assign */}
        <div>
          <ReportsPanel
            assignedToMe={assignedToMe}
            editableProjects={editableProjects}
            assignees={roster.map((m) => ({ id: m.memberId, name: m.name }))}
            myId={contractor.id}
          />
        </div>
      </div>
    </div>
  );
}
