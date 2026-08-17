import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { dailyReports, measurements, planProgressMarks } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { loadPlanForMember } from "@/lib/plan-access";
import type { Point } from "@/lib/scale";
import PlanViewer from "@/components/takeoff/PlanViewer";

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; planId: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const { id, planId } = await params;
  const { report: reportParam } = await searchParams;
  const loaded = await loadPlanForMember(planId, contractor.id);
  if (!loaded || loaded.plan.projectId !== id) notFound();
  const { plan, access } = loaded;

  const db = getDb();

  const rows = await db
    .select()
    .from(measurements)
    .where(eq(measurements.planId, planId))
    .orderBy(asc(measurements.createdAt));

  const markRows = await db
    .select()
    .from(planProgressMarks)
    .where(eq(planProgressMarks.planId, planId))
    .orderBy(asc(planProgressMarks.createdAt));

  // If opened from a daily report ("mark progress"), confirm the report belongs
  // to this project and build the context banner label.
  let reportContext: { id: string; label: string } | null = null;
  if (reportParam) {
    const [r] = await db
      .select({ id: dailyReports.id, reportDate: dailyReports.reportDate })
      .from(dailyReports)
      .where(eq(dailyReports.id, reportParam));
    if (r) {
      reportContext = { id: r.id, label: r.reportDate };
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href={`/projects/${id}/plans`}
        className="text-sm text-white/60 hover:text-brand"
      >
        ← All plans
      </Link>

      <PlanViewer
        canEdit={access.canEdit}
        plan={{
          id: plan.id,
          name: plan.name,
          blobUrl: plan.blobUrl,
          fileType: plan.fileType,
          scaleLabel: plan.scaleLabel,
          feetPerPixel: plan.feetPerPixel,
          renderWidth: plan.renderWidth,
          pageNumber: plan.pageNumber,
        }}
        initialMeasurements={rows.map((m) => ({
          id: m.id,
          label: m.label,
          points: m.points as Point[],
          lengthFeet: m.lengthFeet,
          isClosed: m.isClosed,
        }))}
        initialMarks={markRows.map((mk) => ({
          id: mk.id,
          measurementId: mk.measurementId,
          reportId: mk.reportId,
          statusLabel: mk.statusLabel,
          color: mk.color,
          points: (mk.points as Point[] | null) ?? null,
        }))}
        reportContext={reportContext}
      />
    </div>
  );
}
