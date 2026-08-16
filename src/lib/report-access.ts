import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { dailyReports } from "./db/schema";
import { getProjectAccess, type ProjectAccess } from "./project-access";

// Load a daily report and resolve the caller's access via its project. Returns
// null if the report doesn't exist or the caller isn't a project member.
export async function loadReportForMember(reportId: string, contractorId: string) {
  const [report] = await getDb()
    .select()
    .from(dailyReports)
    .where(eq(dailyReports.id, reportId));
  if (!report) return null;
  const access = await getProjectAccess(report.projectId, contractorId);
  if (!access) return null;
  return { report, access };
}

export type { ProjectAccess };
