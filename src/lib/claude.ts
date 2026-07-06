import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment } from "./whisper";
import { formatTimestamp, type MatchedPhoto } from "./matching";

export type Report = {
  summary: string;
  areas: {
    title: string;
    narrative: string;
    photoIds: string[];
  }[];
  recommendations: string[];
};

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "2-4 sentence overview of the walkthrough: property/job context, overall condition, and the most important takeaway.",
    },
    areas: {
      type: "array",
      description:
        "Findings grouped by area or topic, in the order the contractor walked them.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short area/topic heading" },
          narrative: {
            type: "string",
            description:
              "Professional write-up of what was observed in this area, cleaned up from the spoken narration.",
          },
          photoIds: {
            type: "array",
            items: { type: "string" },
            description:
              "IDs of photos taken while discussing this area. Every photo ID must appear in exactly one area.",
          },
        },
        required: ["title", "narrative", "photoIds"],
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
  required: ["summary", "areas", "recommendations"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You turn a trades contractor's job-site walkthrough into a clean, professional written report they can send to a client. A walkthrough has timestamped photos (usually) and spoken narration (sometimes).

Always produce a useful report from whatever is available — never refuse and never leave it empty:
- Plenty of narration: write it up as findings grouped by area or topic in walkthrough order, cleaned up from speech, with each photo placed in the area whose discussion matches its timestamp.
- Little or no narration: don't force a narrative. Produce a professional visual record instead — organize the photos into one or a few sensibly-titled sections in the order they were taken, give each a brief neutral caption based only on its position/time (e.g. "Photo taken at 0:12"), and note in the summary that this report is primarily a photo log because limited narration was captured.

Rules:
- NEVER fabricate observations, measurements, conditions, or recommendations that the narration doesn't support. When narration is thin or absent, keep everything neutral and factual — describe the record, not imagined findings.
- Every photo ID provided must appear in exactly one area.
- Return at least one area whenever there is any photo or narration.
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
    ? `Timestamped transcript of the walkthrough, with photo markers showing when each photo was taken:\n\n${transcriptLines}\n\nAll photos captured (in order), each of which must appear in exactly one area:\n${photoRoster}\n\nGenerate the walkthrough report.`
    : `This walkthrough captured little or no spoken narration${
        wordCount > 0 ? ` (only: "${segments.map((s) => s.text).join(" ")}")` : ""
      }. Build a professional photo-log report from the photos below. Each photo ID must appear in exactly one area.\n\nPhotos captured (in order):\n${photoRoster}\n\nGenerate the walkthrough report.`;

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

  // Guard against hallucinated photo IDs and ensure every real photo lands
  // somewhere: strip unknown IDs, then append any unplaced photos to the
  // area matching their transcript segment (or the last area as fallback).
  const validIds = new Set(matchedPhotos.map((p) => p.photoId));
  const placed = new Set<string>();
  for (const area of report.areas) {
    area.photoIds = area.photoIds.filter(
      (id) => validIds.has(id) && !placed.has(id),
    );
    area.photoIds.forEach((id) => placed.add(id));
  }
  const unplaced = matchedPhotos.filter((p) => !placed.has(p.photoId));
  if (unplaced.length > 0) {
    // Guarantee an area exists to hold any photos the model left out.
    if (report.areas.length === 0) {
      report.areas.push({
        title: "Site Photos",
        narrative:
          "Photos captured during the walkthrough, in the order they were taken.",
        photoIds: [],
      });
    }
    for (const photo of unplaced) {
      const fraction =
        segments.length > 1 ? photo.segmentIndex / (segments.length - 1) : 0;
      const areaIndex = Math.min(
        Math.floor(fraction * report.areas.length),
        report.areas.length - 1,
      );
      report.areas[areaIndex].photoIds.push(photo.photoId);
    }
  }

  return report;
}
