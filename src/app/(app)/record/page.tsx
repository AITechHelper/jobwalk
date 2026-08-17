import { auth, currentUser } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { dailyReports, projectMembers, projects } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { canEditReports } from "@/lib/project-access";
import WalkthroughRecorder from "@/components/recorder/WalkthroughRecorder";

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; report?: string }>;
}) {
  // Consent lives on the user, so a fresh account always sees the disclosure
  // even on a device where someone else already agreed.
  const user = await currentUser();
  const consented = Boolean(user?.publicMetadata?.aiConsentAt);

  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  // The jobs this contractor can file a walkthrough under (owner or foreman).
  const memberships = await getDb()
    .select({
      id: projects.id,
      name: projects.name,
      role: projectMembers.role,
      createdAt: projects.createdAt,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.contractorId, contractor.id))
    .orderBy(desc(projects.createdAt));

  const editableJobs = memberships
    .filter((m) => m.role === "owner" || m.role === "foreman")
    .map((m) => ({ id: m.id, name: m.name }));

  const { job, report } = await searchParams;
  const preselectedJobId =
    job && editableJobs.some((j) => j.id === job) ? job : null;

  // Capture-session context: recording toward a specific daily report. Verify
  // the caller can edit that report's project before offering it.
  let reportContext: { id: string; projectId: string; label: string } | null =
    null;
  if (report) {
    const [row] = await getDb()
      .select({
        id: dailyReports.id,
        projectId: dailyReports.projectId,
        reportDate: dailyReports.reportDate,
        projectName: projects.name,
        role: projectMembers.role,
      })
      .from(dailyReports)
      .innerJoin(projects, eq(dailyReports.projectId, projects.id))
      .innerJoin(
        projectMembers,
        and(
          eq(projectMembers.projectId, dailyReports.projectId),
          eq(projectMembers.contractorId, contractor.id),
        ),
      )
      .where(eq(dailyReports.id, report));
    if (row && canEditReports(row.role)) {
      reportContext = {
        id: row.id,
        projectId: row.projectId,
        label: `${row.projectName} · ${row.reportDate}`,
      };
    }
  }

  return (
    <WalkthroughRecorder
      initialConsent={consented}
      jobs={editableJobs}
      preselectedJobId={preselectedJobId}
      reportContext={reportContext}
    />
  );
}
