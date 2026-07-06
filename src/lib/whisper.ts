import OpenAI, { toFile } from "openai";

export type TranscriptSegment = {
  start: number; // seconds
  end: number;
  text: string;
};

// Downloads the recorded audio from Blob storage and transcribes it with
// segment-level timestamps — the timestamps are what photo matching runs on.
// Env vars occasionally pick up stray non-ASCII characters when pasted from a
// masked field; the SDK then crashes building the Authorization header. Keep
// only printable ASCII so a bad paste degrades to a normal auth error instead.
function cleanKey(key: string | undefined): string {
  return (key ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

export async function transcribeAudio(
  audioUrl: string,
): Promise<{ segments: TranscriptSegment[]; fullText: string }> {
  const openai = new OpenAI({ apiKey: cleanKey(process.env.OPENAI_API_KEY) });

  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio from blob storage: ${res.status}`);
  }
  const audioBlob = await res.blob();

  // Whisper detects the audio format from the filename extension, so name the
  // file to match what was actually recorded (iOS records mp4, not webm).
  const ext = audioUrl.split("?")[0].split(".").pop()?.toLowerCase();
  const filename =
    ext && ["mp4", "m4a", "webm", "wav", "mp3", "mpeg", "ogg"].includes(ext)
      ? `walkthrough.${ext}`
      : "walkthrough.mp4";

  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(audioBlob, filename),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    language: "en", // avoid foreign-language hallucinations on quiet audio
    temperature: 0,
  });

  const segments = (transcription.segments ?? [])
    // Drop segments Whisper flags as likely silence — this is what produces
    // hallucinated filler ("Thank you.", etc.) when no one is speaking.
    .filter((s) => (s.no_speech_prob ?? 0) < 0.6)
    .map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }))
    .filter((s) => s.text.length > 0);

  const fullText = segments.map((s) => s.text).join(" ").trim();
  return { segments, fullText };
}
