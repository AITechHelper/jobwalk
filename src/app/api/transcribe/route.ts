import { NextResponse } from "next/server";
import { requireContractor } from "@/lib/contractor";
import { transcribeAudio } from "@/lib/whisper";

// Voice-to-text for the daily-report observations field. The client records a
// short clip, uploads it to Blob, and posts the URL here; we run it through the
// same Whisper pipeline the walkthrough uses and return plain text.
export const maxDuration = 120;

export async function POST(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const body = (await req.json()) as { audioUrl?: unknown };
  if (typeof body.audioUrl !== "string" || !body.audioUrl) {
    return NextResponse.json({ error: "audioUrl required" }, { status: 400 });
  }

  try {
    const { fullText } = await transcribeAudio(body.audioUrl);
    return NextResponse.json({ text: fullText });
  } catch (err) {
    console.error("[transcribe] failed:", err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
