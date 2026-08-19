import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { clients, projectMembers, projects } from "@/lib/db/schema";
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

  // Projects the user can start a report on (owner/foreman = can edit).
  const editableProjects = rows
    .filter((r) => r.role === "owner" || r.role === "foreman")
    .map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* One column on phones; two aligned columns on wide screens. Each
          section is a uniform card so the hub reads as a tidy dashboard. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Business overview */}
          <div className="rounded-2xl border border-white/25 bg-navy p-5">
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
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="rounded-full bg-brand/15 px-3 py-1 text-sm font-semibold text-brand">
                  {rows.length} {rows.length === 1 ? "project" : "projects"}
                </span>
                <Link
                  href="/org"
                  className="flex items-center gap-1 text-sm font-semibold text-white/60 transition hover:text-white"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit
                </Link>
              </div>
            </div>

            <dl className="mt-4 flex flex-col gap-1.5 text-sm text-white/70">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-white/45">Contact</dt>
                <dd>{contractor.name}</dd>
              </div>
              {contractor.phone && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-white/45">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${contractor.phone}`}
                      className="hover:text-white"
                    >
                      {contractor.phone}
                    </a>
                  </dd>
                </div>
              )}
              {contractor.email && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-white/45">Email</dt>
                  <dd className="break-all">{contractor.email}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Projects */}
          <div className="rounded-2xl border border-white/25 bg-navy p-5">
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
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Team roster */}
          <div className="rounded-2xl border border-white/25 bg-navy p-5">
            <TeamRoster roster={roster} />
          </div>

          {/* Reports: create & assign */}
          <div className="rounded-2xl border border-white/25 bg-navy p-5">
            <ReportsPanel
              editableProjects={editableProjects}
              assignees={roster.map((m) => ({
                id: m.id,
                name: m.name,
                role: m.role,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
