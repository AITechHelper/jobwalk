import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { loadPlanForMember } from "@/lib/plan-access";

// Update a plan: set/clear its scale (label + calibrated feet-per-pixel), or
// rename it. Editors only.
export async function PATCH(
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

  const input = (await req.json()) as Record<string, unknown>;
  const updates: Partial<typeof plans.$inferInsert> = { updatedAt: new Date() };

  if (input.name !== undefined) {
    if (typeof input.name === "string" && input.name.trim()) {
      updates.name = input.name.trim();
    }
  }
  if (input.scaleLabel !== undefined) {
    updates.scaleLabel =
      typeof input.scaleLabel === "string" && input.scaleLabel
        ? input.scaleLabel
        : null;
  }
  if (input.feetPerPixel !== undefined) {
    updates.feetPerPixel =
      typeof input.feetPerPixel === "number" && Number.isFinite(input.feetPerPixel)
        ? input.feetPerPixel
        : null;
  }
  if (input.renderWidth !== undefined) {
    updates.renderWidth =
      typeof input.renderWidth === "number" && input.renderWidth > 0
        ? Math.round(input.renderWidth)
        : null;
  }
  if (input.pageNumber !== undefined) {
    const n = Number(input.pageNumber);
    if (Number.isInteger(n) && n >= 1) updates.pageNumber = n;
  }

  await getDb().update(plans).set(updates).where(eq(plans.id, planId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
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

  if (loaded.plan.blobUrl) {
    try {
      await del(loaded.plan.blobUrl);
    } catch (err) {
      console.error(`[plans/${planId}] blob cleanup failed:`, err);
    }
  }

  // measurements cascade-delete via the planId FK.
  await getDb().delete(plans).where(eq(plans.id, planId));
  return NextResponse.json({ ok: true });
}
