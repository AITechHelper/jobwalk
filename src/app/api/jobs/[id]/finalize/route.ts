import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { jobs, photos } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { processJob } from "@/lib/pipeline";

// Transcription + report generation can take a couple of minutes for long
// walkthroughs; allow up to 5 on Vercel.
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) {
    return NextResponse.json({ error: "No contractor" }, { status: 400 });
  }

  const { id } = await params;
  const db = getDb();

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.contractorId, contractor.id)));
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const body = await req.json();
  const { audioUrl, durationSeconds, photos: photoList } = body as {
    audioUrl: string;
    durationSeconds: number;
    photos: { url: string; offsetSeconds: number }[];
  };
  if (typeof audioUrl !== "string" || !audioUrl) {
    return NextResponse.json({ error: "audioUrl required" }, { status: 400 });
  }

  await db
    .update(jobs)
    .set({
      audioUrl,
      audioDurationSeconds:
        typeof durationSeconds === "number" ? durationSeconds : null,
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));

  if (Array.isArray(photoList) && photoList.length > 0) {
    await db.insert(photos).values(
      photoList
        .filter(
          (p) =>
            typeof p.url === "string" && typeof p.offsetSeconds === "number",
        )
        .map((p) => ({
          jobId: id,
          blobUrl: p.url,
          offsetSeconds: p.offsetSeconds,
        })),
    );
  }

  try {
    await processJob(id);
  } catch (err) {
    console.error(`Pipeline failed for job ${id}:`, err);
    return NextResponse.json(
      { error: "Processing failed", jobId: id },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, jobId: id });
}
