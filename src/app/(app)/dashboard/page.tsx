import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { clients, projectMembers, projects } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import ProjectsHub from "@/components/projects/ProjectsHub";

// The front dashboard: the contractor's business at a glance, a big primary
// action, then their projects. This is the landing screen after sign-in.
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

  return (
    <div>
      {/* Business overview card */}
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <div className="rounded-2xl border border-white/15 bg-navy p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                {contractor.businessName}
              </h1>
              {contractor.tradeType && (
                <p className="mt-1 text-base capitalize text-white/70">
                  {contractor.tradeType}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-brand/15 px-3 py-1 text-sm font-semibold text-brand">
              {rows.length} {rows.length === 1 ? "project" : "projects"}
            </span>
          </div>

          <dl className="mt-4 flex flex-col gap-1.5 text-base text-white/70">
            <div className="flex gap-2">
              <dt className="text-white/45">Contact</dt>
              <dd>{contractor.name}</dd>
            </div>
            {contractor.phone && (
              <div className="flex gap-2">
                <dt className="text-white/45">Phone</dt>
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
                <dt className="text-white/45">Email</dt>
                <dd className="break-all">{contractor.email}</dd>
              </div>
            )}
          </dl>

          <Link
            href="/record"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-4 text-lg font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85"
          >
            Start a walkthrough
          </Link>
        </div>
      </div>

      {/* Projects */}
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
