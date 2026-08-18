import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { teammates } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";

// DELETE — remove a teammate from the owner's roster. Only removes the roster
// link; it doesn't touch the teammate's own account or any project access they
// were already granted.
export async function DELETE(
  _req: Request,
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
  await getDb()
    .delete(teammates)
    .where(
      and(eq(teammates.id, id), eq(teammates.ownerId, authed.contractor.id)),
    );

  return NextResponse.json({ ok: true });
}
