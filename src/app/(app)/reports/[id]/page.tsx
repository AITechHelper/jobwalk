import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import {
  clients,
  contractors,
  projectAreas,
  projects,
  reportComments,
  reportPhotos,
  teamMembers,
} from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { loadReportForMember } from "@/lib/report-access";
import { getOrSeedActivityTypes } from "@/lib/lookups";
import { readReportBody } from "@/lib/dailyReport";
import type { WeatherData } from "@/lib/weather";
import DailyReportEditor from "@/components/report/DailyReportEditor";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const { id } = await params;
  const loaded = await loadReportForMember(id, contractor.id);
  if (!loaded) notFound();
  const { report, access } = loaded;

  const db = getDb();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, report.projectId));

  const [client] = project?.clientId
    ? await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, project.clientId))
    : [];

  // The company that owns this project — its business name and phone head every
  // report so a contractor never re-types them. Sourced from the account, not
  // the report.
  const [company] = await db
    .select({
      businessName: contractors.businessName,
      phone: contractors.phone,
    })
    .from(contractors)
    .where(eq(contractors.id, project.contractorId));

  const areas = await db
    .select({ id: projectAreas.id, name: projectAreas.name })
    .from(projectAreas)
    .where(eq(projectAreas.projectId, report.projectId))
    .orderBy(asc(projectAreas.createdAt));

  // Crew available for this project: company-wide (null projectId) + this
  // project's own members.
  const crew = await db
    .select({
      id: teamMembers.id,
      name: teamMembers.name,
      trade: teamMembers.trade,
      projectId: teamMembers.projectId,
    })
    .from(teamMembers)
    .where(eq(teamMembers.contractorId, project.contractorId))
    .orderBy(asc(teamMembers.name));
  const projectCrew = crew.filter(
    (m) => m.projectId === null || m.projectId === report.projectId,
  );

  const activities = await getOrSeedActivityTypes(project.contractorId);

  const photos = await db
    .select()
    .from(reportPhotos)
    .where(eq(reportPhotos.reportId, id))
    .orderBy(asc(reportPhotos.createdAt));

  const comments = await db
    .select()
    .from(reportComments)
    .where(eq(reportComments.reportId, id))
    .orderBy(asc(reportComments.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/projects/${report.projectId}`}
        className="text-sm text-white/60 hover:text-brand print:hidden"
      >
        ← {project?.name ?? "Project"}
      </Link>

      <DailyReportEditor
        canEdit={access.canEdit}
        report={{
          id: report.id,
          reportDate: report.reportDate,
          status: report.status,
          jobType: report.jobType,
          reporterName: report.reporterName,
          generalContractor: report.generalContractor,
          reviewerName: report.reviewerName,
          body: readReportBody(report.body),
          weather: (report.weather as WeatherData | null) ?? null,
        }}
        project={{
          name: project?.name ?? "",
          siteAddress: project?.siteAddress ?? null,
          clientName: client?.name ?? null,
        }}
        company={{
          businessName: company?.businessName ?? null,
          phone: company?.phone ?? null,
        }}
        areas={areas}
        crew={projectCrew.map((m) => ({
          id: m.id,
          name: m.name,
          trade: m.trade,
        }))}
        activities={activities}
        photos={photos.map((p) => ({
          id: p.id,
          blobUrl: p.blobUrl,
          areaId: p.areaId,
          caption: p.caption,
        }))}
        comments={comments.map((c) => ({
          id: c.id,
          parentId: c.parentId,
          authorName: c.authorName,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
