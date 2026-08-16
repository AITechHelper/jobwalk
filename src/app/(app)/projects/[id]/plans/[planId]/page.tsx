import { auth } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { measurements } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { loadPlanForMember } from "@/lib/plan-access";
import type { Point } from "@/lib/scale";
import PlanViewer from "@/components/takeoff/PlanViewer";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const { id, planId } = await params;
  const loaded = await loadPlanForMember(planId, contractor.id);
  if (!loaded || loaded.plan.projectId !== id) notFound();
  const { plan, access } = loaded;

  const rows = await getDb()
    .select()
    .from(measurements)
    .where(eq(measurements.planId, planId))
    .orderBy(asc(measurements.createdAt));

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
      />
    </div>
  );
}
