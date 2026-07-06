import OpenAI, { toFile } from "openai";

export type TranscriptSegment = {
  start: number; // seconds
  end: number;
  text: string;
};

// Downloads the recorded audio from Blob storage and transcribes it with
// segment-level timestamps — the timestamps are what photo matching runs on.
export async function transcribeAudio(
  audioUrl: string,
): Promise<{ segments: TranscriptSegment[]; fullText: string }> {
  const openai = new OpenAI();

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
  });

  const segments = (transcription.segments ?? []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));

  return { segments, fullText: transcription.text };
}
