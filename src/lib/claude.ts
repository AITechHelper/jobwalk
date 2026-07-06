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

const SYSTEM_PROMPT = `You turn a trades contractor's spoken job-site walkthrough into a clean, professional written report the contractor can send to a client.

Rules:
- Write in clear, professional language a homeowner or client can understand. Keep trade terminology where it's precise, but don't invent details that weren't said.
- Fix the roughness of speech (filler words, restarts, slang) without changing meaning.
- Group findings by area or topic following the order of the walkthrough.
- Photo placement: each photo has a timestamp and was taken while the contractor was talking about something. Place each photo's ID in the area whose discussion matches its timestamp. Every photo ID must be used exactly once.
- Never fabricate observations, measurements, or recommendations that are not supported by the transcript.`;

export async function generateReport(
  segments: TranscriptSegment[],
  matchedPhotos: MatchedPhoto[],
): Promise<Report> {
  const anthropic = new Anthropic();

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

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    output_config: {
      format: { type: "json_schema", schema: REPORT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Here is the timestamped transcript of a job-site walkthrough, with photo markers showing when each photo was taken:\n\n${transcriptLines}\n\nGenerate the walkthrough report.`,
      },
    ],
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
  if (unplaced.length > 0 && report.areas.length > 0) {
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
