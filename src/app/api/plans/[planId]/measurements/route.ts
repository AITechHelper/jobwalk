import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { measurements } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadPlanForMember } from "@/lib/plan-access";
import { polylinePixels, type Point } from "@/lib/scale";

// Save a traced measurement (its points in the plan's calibrated pixel space
// and the computed real-world length). Editors only.
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

  const body = (await req.json()) as {
    label?: unknown;
    points?: unknown;
    isClosed?: unknown;
  };

  if (!Array.isArray(body.points) || body.points.length < 2) {
    return NextResponse.json(
      { error: "at least two points required" },
      { status: 400 },
    );
  }
  const points: Point[] = body.points
    .map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return { x: Number(o.x), y: Number(o.y) };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (points.length < 2) {
    return NextResponse.json({ error: "invalid points" }, { status: 400 });
  }

  const isClosed = Boolean(body.isClosed);

  // Recompute length server-side from the plan's stored calibration so a client
  // can't post a bogus length.
  const feetPerPixel = loaded.plan.feetPerPixel ?? 0;
  const lengthFeet = feetPerPixel
    ? polylinePixels(points, isClosed) * feetPerPixel
    : 0;

  const [row] = await getDb()
    .insert(measurements)
    .values({
      planId,
      label:
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim()
          : null,
      points,
      lengthFeet,
      isClosed,
    })
    .returning();

  return NextResponse.json({ measurement: row });
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

  const measurementId = new URL(req.url).searchParams.get("measurementId");
  if (!measurementId) {
    return NextResponse.json({ error: "measurementId required" }, { status: 400 });
  }

  await getDb()
    .delete(measurements)
    .where(
      and(eq(measurements.id, measurementId), eq(measurements.planId, planId)),
    );
  return NextResponse.json({ ok: true });
}
