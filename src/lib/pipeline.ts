import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { jobs, photos } from "./db/schema";
import { transcribeAudio } from "./whisper";
import { matchPhotosToSegments } from "./matching";
import { generateReport } from "./claude";

// The full processing pipeline for one job:
// audio → Whisper transcript → photo/segment matching → Claude report.
// Idempotent: safe to re-run on a failed job.
export async function processJob(jobId: string): Promise<void> {
  const db = getDb();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (!job.audioUrl) throw new Error(`Job ${jobId} has no audio`);

  await db
    .update(jobs)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(jobs.id, jobId));

  try {
    const jobPhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.jobId, jobId));

    const { segments } = await transcribeAudio(job.audioUrl);
    if (segments.length === 0) {
      throw new Error("Transcription produced no speech segments");
    }

    const matched = matchPhotosToSegments(
      segments,
      jobPhotos.map((p) => ({ photoId: p.id, offsetSeconds: p.offsetSeconds })),
    );

    const report = await generateReport(segments, matched);

    await db
      .update(jobs)
      .set({
        transcript: segments,
        report,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  } catch (err) {
    await db
      .update(jobs)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
    throw err;
  }
}
