import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dailyReports } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadProjectForMember } from "@/lib/project-access";
import { emptyReportBody } from "@/lib/dailyReport";
import { fetchWeather } from "@/lib/weather";

// Weather geocode/pull can take a few seconds; give it room.
export const maxDuration = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const { id } = await params;
  const loaded = await loadProjectForMember(id, authed.contractor.id);
  if (!loaded) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!loaded.access.canEdit) {
    return NextResponse.json(
      { error: "You have view-only access to this project" },
      { status: 403 },
    );
  }
  const { project } = loaded;

  const body = (await req.json().catch(() => ({}))) as {
    reportDate?: unknown;
    reporterName?: unknown;
    generalContractor?: unknown;
    reviewerName?: unknown;
  };

  const reportDate =
    typeof body.reportDate === "string" && DATE_RE.test(body.reportDate)
      ? body.reportDate
      : new Date().toISOString().slice(0, 10);

  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  // Automated weather: reuse the project's cached coordinates and pull for the
  // report's date. Backdated dates get historical weather; same-day/future get
  // the forecast. Never blocks report creation — stores null if unreachable.
  let weather = null;
  if (project.latitude != null && project.longitude != null) {
    weather = await fetchWeather(
      { latitude: project.latitude, longitude: project.longitude },
      reportDate,
    );
  }

  const [report] = await getDb()
    .insert(dailyReports)
    .values({
      projectId: project.id,
      createdById: authed.contractor.id,
      reportDate,
      status: "draft",
      jobType: project.jobType,
      reporterName: str(body.reporterName) ?? authed.contractor.name,
      // Default the GC from the project record so it isn't retyped each day;
      // still overridable per report.
      generalContractor: str(body.generalContractor) ?? project.generalContractor,
      reviewerName: str(body.reviewerName),
      body: emptyReportBody(),
      weather,
      shareToken: randomBytes(16).toString("base64url"),
    })
    .returning();

  return NextResponse.json({ report, weatherPulled: Boolean(weather) });
}
