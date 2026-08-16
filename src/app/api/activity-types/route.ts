import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { activityTypes } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";

// Add a custom activity type to the workforce dropdown list.
export async function POST(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const body = (await req.json()) as { name?: unknown };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [row] = await getDb()
    .insert(activityTypes)
    .values({ contractorId: authed.contractor.id, name: body.name.trim() })
    .onConflictDoNothing()
    .returning();

  // onConflictDoNothing returns nothing when it already exists — treat as OK.
  return NextResponse.json({ activityType: row ?? null });
}
