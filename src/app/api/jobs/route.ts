import { randomBytes } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dailyReports, jobs } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { getProjectAccess } from "@/lib/project-access";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contractor = await getContractorByClerkId(userId);
  if (!contractor) {
    return NextResponse.json(
      { error: "Complete onboarding first" },
      { status: 400 },
    );
  }

  const { title, projectId, reportId } = (await req.json()) as {
    title?: unknown;
    projectId?: unknown;
    reportId?: unknown;
  };
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  let linkedProjectId: string | null = null;
  let linkedReportId: string | null = null;

  if (typeof reportId === "string" && reportId) {
    // Capture session for a daily report: only project members who can edit may
    // contribute. The session links to both the report and its project.
    const [report] = await getDb()
      .select({ id: dailyReports.id, projectId: dailyReports.projectId })
      .from(dailyReports)
      .where(eq(dailyReports.id, reportId));
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const access = await getProjectAccess(report.projectId, contractor.id);
    if (!access || !access.canEdit) {
      return NextResponse.json(
        { error: "You can't contribute to that report" },
        { status: 403 },
      );
    }
    linkedReportId = report.id;
    linkedProjectId = report.projectId;
  } else if (typeof projectId === "string" && projectId) {
    // A standalone walkthrough attached to a project. Only owner/foreman.
    const access = await getProjectAccess(projectId, contractor.id);
    if (!access || !access.canEdit) {
      return NextResponse.json(
        { error: "You can't add walkthroughs to that project" },
        { status: 403 },
      );
    }
    linkedProjectId = projectId;
  }

  const [job] = await getDb()
    .insert(jobs)
    .values({
      contractorId: contractor.id,
      projectId: linkedProjectId,
      dailyReportId: linkedReportId,
      title: title.trim(),
      shareToken: randomBytes(16).toString("base64url"),
    })
    .returning();

  return NextResponse.json({ job });
}
