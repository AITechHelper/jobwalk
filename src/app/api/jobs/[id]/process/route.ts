import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { processJob } from "@/lib/pipeline";

export const maxDuration = 300;

// Re-runs the pipeline for a job whose processing failed. Audio and photos
// are already stored, so this is a pure retry.
export async function POST(
  _req: Request,
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
  const [job] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.contractorId, contractor.id)));
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    await processJob(id);
  } catch (err) {
    console.error(`Pipeline retry failed for job ${id}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
