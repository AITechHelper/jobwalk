import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment } from "./whisper";
import { formatTimestamp, type MatchedPhoto } from "./matching";

export type ReportNote = {
  text: string;
  photoIds: string[];
};

export type Report = {
  summary: string;
  notes: ReportNote[];
  recommendations: string[];
};

// Back-compat: older reports were stored as grouped "areas" (a title +
// narrative + a cluster of photos). Surface them as individual notes so those
// reports still render after the switch to one-note-per-observation.
type LegacyArea = { title?: string; narrative?: string; photoIds?: string[] };
export function reportNotes(report: Report): ReportNote[] {
  if (Array.isArray(report.notes)) return report.notes;
  const legacy = report as unknown as { areas?: LegacyArea[] };
  if (Array.isArray(legacy.areas)) {
    return legacy.areas.map((a) => ({
      text: [a.title, a.narrative].filter(Boolean).join(" — "),
      photoIds: a.photoIds ?? [],
    }));
  }
  return [];
}

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "2-4 sentence overview of the walkthrough: property/job context, overall condition, and the most important takeaway.",
    },
    notes: {
      type: "array",
      description:
        "Individual observations in walkthrough order. Each note is ONE discrete thing the contractor pointed out or that one photo shows — never a grouped multi-topic paragraph.",
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "One observation, one or two sentences, tidied up from the spoken narration (or a brief neutral caption if there was little narration).",
          },
          photoIds: {
            type: "array",
            items: { type: "string" },
            description:
              "ID(s) of the photo(s) that depict this observation — usually exactly one. Capture time is a rough anchor only; a photo may have been taken a few seconds before or after the observation was narrated, so match on what the photo shows, not the exact word spoken at capture time. Every photo ID must appear in exactly one note.",
          },
        },
        required: ["text", "photoIds"],
        additionalProperties: false,
      },
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description:
        "Recommended next steps or repairs the contractor mentioned or that clearly follow from the findings. Empty array if none.",
    },
  },
  required: ["summary", "notes", "recommendations"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You turn a trades contractor's job-site walkthrough into a clean, professional written report they can send to a client. A walkthrough has timestamped photos (usually) and spoken narration (sometimes).

Break the walkthrough into INDIVIDUAL NOTES — one discrete observation each, in the order they happened. Do NOT group several observations into one big paragraph, and do NOT attach a cluster of unrelated photos to one note.

Each note:
- Is one thing the contractor pointed out, or the one thing a photo shows.
- Is a clean sentence or two, tidied up from speech.
- Carries the photo(s) taken while that observation was being made — usually exactly one photo per note.

A photo's capture time is only a ROUGH ANCHOR, not proof of what was being said at that instant. Contractors routinely snap the picture a few seconds BEFORE or AFTER they describe what it shows — they photograph an area and then narrate it, or narrate and then photograph. So don't weld a photo to whatever word happened to be spoken at its exact timestamp. Look at the narration in the seconds around each photo (both before and after) and attach it to the observation it actually depicts. When a photo lands during silence or during talk about a different area, pull it to the nearest observation that plausibly matches what the photo shows.

Always produce a useful report from whatever is available — never refuse and never leave it empty:
- With narration: turn each observation into its own note, pairing it with the photo(s) that show what's being discussed — using the surrounding narration, not just the exact capture instant, to decide which observation each photo belongs to.
- Little or no narration: make each photo its own note with a brief neutral caption based only on its position/time (e.g. "Photo taken at 0:12"), and say in the summary that this is primarily a photo log because limited narration was captured.

Rules:
- NEVER fabricate observations, measurements, conditions, or recommendations that the narration doesn't support. When narration is thin or absent, keep notes neutral and factual — describe the record, not imagined findings.
- Every photo ID provided must appear in exactly one note.
- Prefer one photo per note; only put multiple photos in a single note if they clearly show the same one thing.
- Return at least one note whenever there is any photo or narration.
- Clear language a homeowner understands; keep precise trade terms where used.
- recommendations may be an empty array if none were stated or clearly implied.`;

// Strip stray non-ASCII characters a key can pick up from a masked-field paste
// so a bad env value degrades to a normal auth error instead of a hard crash.
function cleanKey(key: string | undefined): string {
  return (key ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

export async function generateReport(
  segments: TranscriptSegment[],
  matchedPhotos: MatchedPhoto[],
): Promise<Report> {
  const anthropic = new Anthropic({
    apiKey: cleanKey(process.env.ANTHROPIC_API_KEY),
  });

  const wordCount = segments.reduce(
    (n, s) => n + s.text.split(/\s+/).filter(Boolean).length,
    0,
  );
  const hasNarration = wordCount >= 6;

  const transcriptLines = segments
    .map((s, i) => {
      const photosHere = matchedPhotos
        .filter((p) => p.segmentIndex === i)
        .map(
          (p) =>
            `[PHOTO ${p.photoId} taken at ${formatTimestamp(p.offsetSeconds)}]`,
        )
        .join(" ");
      const stamp = `[${formatTimestamp(s.start)}]`;
      return photosHere
        ? `${stamp} ${s.text} ${photosHere}`
        : `${stamp} ${s.text}`;
    })
    .join("\n");

  // Always give the model the full ordered photo roster so photos are covered
  // even when there are no transcript segments to attach markers to.
  const photoRoster =
    matchedPhotos
      .slice()
      .sort((a, b) => a.offsetSeconds - b.offsetSeconds)
      .map(
        (p) => `- PHOTO ${p.photoId} taken at ${formatTimestamp(p.offsetSeconds)}`,
      )
      .join("\n") || "(No photos were taken.)";

  const userContent = hasNarration
    ? `Timestamped transcript of the walkthrough, with photo markers showing when each photo was taken:\n\n${transcriptLines}\n\nAll photos captured (in order), each of which must appear in exactly one note:\n${photoRoster}\n\nGenerate the walkthrough report as individual notes.`
    : `This walkthrough captured little or no spoken narration${
        wordCount > 0 ? ` (only: "${segments.map((s) => s.text).join(" ")}")` : ""
      }. Build a professional photo-log report from the photos below — one note per photo. Each photo ID must appear in exactly one note.\n\nPhotos captured (in order):\n${photoRoster}\n\nGenerate the walkthrough report.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    output_config: {
      format: { type: "json_schema", schema: REPORT_SCHEMA },
    },
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Report generation was declined");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in report response");
  }

  const report = JSON.parse(textBlock.text) as Report;
  if (!Array.isArray(report.notes)) report.notes = [];

  // Guard against hallucinated photo IDs and ensure every real photo lands in
  // exactly one note: strip unknown/duplicate IDs, drop empty notes, then turn
  // any photo the model left out into its own note (time-ordered) so nothing is
  // lost and each stray photo stays an individual entry.
  const validIds = new Set(matchedPhotos.map((p) => p.photoId));
  const placed = new Set<string>();
  for (const note of report.notes) {
    note.photoIds = (note.photoIds ?? []).filter(
      (id) => validIds.has(id) && !placed.has(id),
    );
    note.photoIds.forEach((id) => placed.add(id));
  }
  report.notes = report.notes.filter(
    (n) => (n.text && n.text.trim()) || n.photoIds.length > 0,
  );

  const unplaced = matchedPhotos
    .filter((p) => !placed.has(p.photoId))
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  for (const photo of unplaced) {
    report.notes.push({
      text: `Photo taken at ${formatTimestamp(photo.offsetSeconds)}.`,
      photoIds: [photo.photoId],
    });
  }

  return report;
}
