import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment } from "./whisper";

// A capture session that feeds a daily report: one crew member's walkthrough.
export type CaptureSession = {
  contributorName: string;
  segments: TranscriptSegment[];
  photoCount: number;
};

export type CaptureContribution = { name: string; summary: string };

// Stored on daily_reports.contributions. Kept separate from the manually-typed
// observations so a merge never clobbers what a foreman wrote by hand.
export type CaptureMerge = {
  narrative: string;
  contributors: CaptureContribution[];
  mergedAt: string;
};

const MERGE_SCHEMA = {
  type: "object",
  properties: {
    narrative: {
      type: "string",
      description:
        "One unified daily-log narrative combining every crew member's observations for the day. Reads as a single cohesive account of the site that day — NOT separate sections per person, no 'John said…/Maria said…' headers. Weave overlapping observations together and order them logically (by area or trade). Plain, professional language.",
    },
    contributors: {
      type: "array",
      description:
        "One entry per crew member whose session was included, with a one-line summary of what they covered.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          summary: {
            type: "string",
            description:
              "One sentence on what this person walked/covered (areas, trades, issues). Neutral and factual.",
          },
        },
        required: ["name", "summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["narrative", "contributors"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You combine several crew members' spoken job-site walkthroughs from the SAME day into ONE unified "observations" section of a daily construction report.

The result must read as a single cohesive daily log of what was happening on site — one voice, organized by area or trade — NOT a stitched-together list of separate per-person entries. Do not write "Contributor 1 said" or attach each person's name inside the narrative; blend their observations into one account, merging overlaps.

Separately, produce a short attribution list: one line per contributor summarizing what they covered.

Rules:
- NEVER fabricate observations, measurements, conditions, or work that the transcripts don't support.
- If a session had little or no narration, don't invent content for it; you may note briefly that a contributor mainly captured photos.
- Keep trade terms; keep it professional and readable.
- If there is essentially no spoken content across all sessions, return a short neutral narrative saying the day's capture was primarily photos, and still list the contributors.`;

function cleanKey(key: string | undefined): string {
  return (key ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

// Merge multiple contributors' capture sessions into a single narrative plus
// per-contributor attribution. Throws on refusal / malformed output so the
// caller can surface a clear error.
export async function mergeCaptureSessions(
  sessions: CaptureSession[],
): Promise<Omit<CaptureMerge, "mergedAt">> {
  const anthropic = new Anthropic({
    apiKey: cleanKey(process.env.ANTHROPIC_API_KEY),
  });

  const blocks = sessions
    .map((s, i) => {
      const text = s.segments
        .map((seg) => seg.text)
        .join(" ")
        .trim();
      const body =
        text.length > 0
          ? text
          : `(No spoken narration — ${s.photoCount} photo${
              s.photoCount === 1 ? "" : "s"
            } captured.)`;
      return `--- Contributor ${i + 1}: ${s.contributorName} (${s.photoCount} photo${
        s.photoCount === 1 ? "" : "s"
      }) ---\n${body}`;
    })
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: {
      format: { type: "json_schema", schema: MERGE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Here are today's capture sessions from ${sessions.length} crew member(s). Combine them into one unified observations narrative and list each contributor.\n\n${blocks}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Capture merge was declined");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in merge response");
  }

  const parsed = JSON.parse(textBlock.text) as Omit<CaptureMerge, "mergedAt">;
  if (!Array.isArray(parsed.contributors)) parsed.contributors = [];
  return parsed;
}
