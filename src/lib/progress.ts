// Preset completion statuses for plan progress marking, each with a swatch
// color. Users can also type a custom label; custom marks fall back to the
// "custom" color. Progress-only — no cost/estimate meaning here.

export type ProgressStatus = { label: string; color: string };

export const PROGRESS_STATUSES: ProgressStatus[] = [
  { label: "Demo", color: "#a3a3a3" },
  { label: "Framed", color: "#f59e0b" },
  { label: "Rough-in", color: "#8b5cf6" },
  { label: "Insulation", color: "#ec4899" },
  { label: "Drywall installed", color: "#3b82f6" },
  { label: "Painted", color: "#14b8a6" },
  { label: "Complete", color: "#22c55e" },
];

export const CUSTOM_STATUS_COLOR = "#64748b";

export function colorForStatus(label: string): string {
  return (
    PROGRESS_STATUSES.find(
      (s) => s.label.toLowerCase() === label.trim().toLowerCase(),
    )?.color ?? CUSTOM_STATUS_COLOR
  );
}

// Shortest distance (in the same units as the points) from p to the polyline
// through pts — used to decide whether a tap landed on a traced wall.
export function distanceToPolyline(
  p: { x: number; y: number },
  pts: { x: number; y: number }[],
  closed = false,
): number {
  if (pts.length === 0) return Infinity;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y);
  let min = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    min = Math.min(min, distanceToSegment(p, a, b));
  }
  return min;
}

function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Centroid of a set of points — where a mark's status chip is anchored.
export function centroid(pts: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  if (pts.length === 0) return { x: 0, y: 0 };
  const s = pts.reduce((acc, q) => ({ x: acc.x + q.x, y: acc.y + q.y }), {
    x: 0,
    y: 0,
  });
  return { x: s.x / pts.length, y: s.y / pts.length };
}
