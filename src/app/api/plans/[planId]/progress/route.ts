import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  dailyReports,
  measurements,
  planProgressMarks,
} from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadPlanForMember } from "@/lib/plan-access";
import type { Point } from "@/lib/scale";

// Create a progress mark on a plan: either tag an already-traced measurement or
// drop a freeform pin/region, with a status label. Editors only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const { planId } = await params;
  const loaded = await loadPlanForMember(planId, authed.contractor.id);
  if (!loaded) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (!loaded.access.canEdit) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    statusLabel?: unknown;
    color?: unknown;
    measurementId?: unknown;
    reportId?: unknown;
    points?: unknown;
  };

  const statusLabel =
    typeof body.statusLabel === "string" ? body.statusLabel.trim() : "";
  if (!statusLabel) {
    return NextResponse.json({ error: "statusLabel required" }, { status: 400 });
  }

  // A mark tags a traced measurement OR carries its own points — never both.
  let measurementId: string | null = null;
  let points: Point[] | null = null;

  if (typeof body.measurementId === "string" && body.measurementId) {
    const [m] = await getDb()
      .select({ id: measurements.id })
      .from(measurements)
      .where(
        and(
          eq(measurements.id, body.measurementId),
          eq(measurements.planId, planId),
        ),
      );
    if (!m) {
      return NextResponse.json(
        { error: "measurement not found on this plan" },
        { status: 400 },
      );
    }
    measurementId = m.id;
  } else if (Array.isArray(body.points)) {
    const parsed = body.points
      .map((p) => {
        const o = (p ?? {}) as Record<string, unknown>;
        return { x: Number(o.x), y: Number(o.y) };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (parsed.length < 1) {
      return NextResponse.json(
        { error: "points or measurementId required" },
        { status: 400 },
      );
    }
    points = parsed;
  } else {
    return NextResponse.json(
      { error: "points or measurementId required" },
      { status: 400 },
    );
  }

  // If a report is supplied, it must belong to the same project as the plan so
  // marks can't be logged against another account's report.
  let reportId: string | null = null;
  if (typeof body.reportId === "string" && body.reportId) {
    const [r] = await getDb()
      .select({ id: dailyReports.id })
      .from(dailyReports)
      .where(
        and(
          eq(dailyReports.id, body.reportId),
          eq(dailyReports.projectId, loaded.plan.projectId),
        ),
      );
    if (r) reportId = r.id;
  }

  const [row] = await getDb()
    .insert(planProgressMarks)
    .values({
      planId,
      measurementId,
      reportId,
      createdById: authed.contractor.id,
      statusLabel,
      color: typeof body.color === "string" ? body.color : null,
      points,
    })
    .returning();

  return NextResponse.json({ mark: row });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const { planId } = await params;
  const loaded = await loadPlanForMember(planId, authed.contractor.id);
  if (!loaded) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (!loaded.access.canEdit) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const markId = new URL(req.url).searchParams.get("markId");
  if (!markId) {
    return NextResponse.json({ error: "markId required" }, { status: 400 });
  }

  await getDb()
    .delete(planProgressMarks)
    .where(
      and(
        eq(planProgressMarks.id, markId),
        eq(planProgressMarks.planId, planId),
      ),
    );
  return NextResponse.json({ ok: true });
}
