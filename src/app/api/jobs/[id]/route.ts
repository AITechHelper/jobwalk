import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { jobs, photos } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { getProjectAccess } from "@/lib/project-access";
import type { Report } from "@/lib/claude";

// Coerce a client-supplied report into the stored shape, dropping anything
// unexpected. Editing only touches text — photoIds are carried through as
// strings (the editor never lets the user change them) so photos stay attached.
function sanitizeReport(input: unknown): Report | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.summary !== "string" || !Array.isArray(r.notes)) return null;

  const notes = r.notes.map((n) => {
    const note = (n ?? {}) as Record<string, unknown>;
    return {
      text: typeof note.text === "string" ? note.text : "",
      photoIds: Array.isArray(note.photoIds)
        ? note.photoIds.filter((x): x is string => typeof x === "string")
        : [],
    };
  });

  const recommendations = Array.isArray(r.recommendations)
    ? r.recommendations.filter((x): x is string => typeof x === "string")
    : [];

  return { summary: r.summary, notes, recommendations };
}

async function loadOwnedJob(id: string, clerkUserId: string) {
  const contractor = await getContractorByClerkId(clerkUserId);
  if (!contractor) return null;
  const [job] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.contractorId, contractor.id)));
  return job ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const [job] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.contractorId, contractor.id)));
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    title?: unknown;
    report?: unknown;
    projectId?: unknown;
  };
  const updates: Partial<typeof jobs.$inferInsert> = { updatedAt: new Date() };

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json(
        { error: "title cannot be empty" },
        { status: 400 },
      );
    }
    updates.title = body.title.trim();
  }

  // Move the walkthrough into a project (or "" / null to detach it). Assigning
  // requires the contractor to have edit rights on the target project.
  if (body.projectId !== undefined) {
    if (body.projectId === null || body.projectId === "") {
      updates.projectId = null;
    } else if (typeof body.projectId === "string") {
      const access = await getProjectAccess(body.projectId, contractor.id);
      if (!access || !access.canEdit) {
        return NextResponse.json(
          { error: "You can't move this walkthrough to that project" },
          { status: 403 },
        );
      }
      updates.projectId = body.projectId;
    } else {
      return NextResponse.json({ error: "invalid projectId" }, { status: 400 });
    }
  }

  if (body.report !== undefined) {
    const cleaned = sanitizeReport(body.report);
    if (!cleaned) {
      return NextResponse.json({ error: "invalid report" }, { status: 400 });
    }
    updates.report = cleaned;
  }

  await getDb().update(jobs).set(updates).where(eq(jobs.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const job = await loadOwnedJob(id, userId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Best-effort blob cleanup so deleting a job doesn't orphan audio/photos in
  // storage. A blob failure must not block the DB delete, so swallow errors.
  const jobPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.jobId, id));
  const blobUrls = [
    job.audioUrl,
    ...jobPhotos.map((p) => p.blobUrl),
  ].filter((u): u is string => typeof u === "string" && u.length > 0);
  if (blobUrls.length > 0) {
    try {
      await del(blobUrls);
    } catch (err) {
      console.error(`[jobs/${id}] blob cleanup failed:`, err);
    }
  }

  // photos rows cascade-delete via the jobId FK.
  await db.delete(jobs).where(eq(jobs.id, id));
  return NextResponse.json({ ok: true });
}
