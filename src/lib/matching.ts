import type { TranscriptSegment } from "./whisper";

export type MatchedPhoto = {
  photoId: string;
  offsetSeconds: number;
  segmentIndex: number;
};

// Match each photo to the transcript segment the contractor was speaking
// when they took it: the segment whose [start, end] contains the offset,
// or the nearest segment by midpoint distance otherwise.
export function matchPhotosToSegments(
  segments: TranscriptSegment[],
  photos: { photoId: string; offsetSeconds: number }[],
): MatchedPhoto[] {
  return photos.map(({ photoId, offsetSeconds }) => {
    let segmentIndex = segments.findIndex(
      (s) => offsetSeconds >= s.start && offsetSeconds <= s.end,
    );

    if (segmentIndex === -1 && segments.length > 0) {
      let best = 0;
      let bestDistance = Infinity;
      segments.forEach((s, i) => {
        const mid = (s.start + s.end) / 2;
        const distance = Math.abs(mid - offsetSeconds);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      segmentIndex = best;
    }

    return { photoId, offsetSeconds, segmentIndex: Math.max(segmentIndex, 0) };
  });
}

export function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
