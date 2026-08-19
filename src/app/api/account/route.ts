import { auth, clerkClient } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contractors, jobs, photos } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";

// Update the signed-in contractor's org / account details. Email is managed by
// Clerk and not editable here.
export async function PATCH(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Partial<typeof contractors.$inferInsert> = {
    updatedAt: new Date(),
  };
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;

  if (str(body.name)) updates.name = str(body.name);
  if (str(body.businessName)) updates.businessName = str(body.businessName);
  if (str(body.phone)) updates.phone = str(body.phone);
  if (str(body.tradeType)) updates.tradeType = str(body.tradeType);

  await getDb()
    .update(contractors)
    .set(updates)
    .where(eq(contractors.id, authed.contractor.id));

  return NextResponse.json({ ok: true });
}

// Permanently deletes the signed-in contractor's account: every job, its
// audio/photo blobs, the contractor row (jobs + photos cascade via FK), and
// the Clerk user itself. Required by App Store guideline 5.1.1(v) — account
// creation must come with in-app account deletion.
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [contractor] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.clerkUserId, userId));

  if (contractor) {
    const contractorJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.contractorId, contractor.id));

    const jobPhotos =
      contractorJobs.length > 0
        ? await Promise.all(
            contractorJobs.map((job) =>
              db.select().from(photos).where(eq(photos.jobId, job.id)),
            ),
          )
        : [];

    const blobUrls = [
      ...contractorJobs.map((j) => j.audioUrl),
      ...jobPhotos.flat().map((p) => p.blobUrl),
    ].filter((u): u is string => typeof u === "string" && u.length > 0);

    if (blobUrls.length > 0) {
      try {
        await del(blobUrls);
      } catch (err) {
        console.error(`[account/${userId}] blob cleanup failed:`, err);
      }
    }

    // jobs + photos rows cascade-delete via the contractorId/jobId FKs.
    await db.delete(contractors).where(eq(contractors.id, contractor.id));
  }

  const client = await clerkClient();
  await client.users.deleteUser(userId);

  return NextResponse.json({ ok: true });
}
