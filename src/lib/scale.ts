// Architectural scales for the plan takeoff tool.
//
// A scale like 1/4"=1' means a quarter-inch on the drawing represents one real
// foot. We express each scale as `feetPerDrawingInch` — how many real feet one
// inch of the drawing represents (the inverse of the drawing-inches-per-foot).
//   1/4"=1'  → 0.25 drawing-in per ft → 4 ft per drawing-inch
//   1"=20'   → 20 ft per drawing-inch
//
// v1 is manual: the user picks the scale, no calibration clicks, no
// auto-detection. Pixel distances are converted to real feet using the drawing's
// true physical size — for a PDF that's the page size (points ÷ 72 = inches);
// for an image we assume 96 DPI. See feetPerPixel() below.

export type ScaleOption = {
  label: string;
  feetPerDrawingInch: number;
};

export const SCALE_OPTIONS: ScaleOption[] = [
  { label: '1/16"=1\'', feetPerDrawingInch: 16 },
  { label: '1/8"=1\'', feetPerDrawingInch: 8 },
  { label: '1/4"=1\'', feetPerDrawingInch: 4 },
  { label: '1/2"=1\'', feetPerDrawingInch: 2 },
  { label: '1"=1\'', feetPerDrawingInch: 1 },
  { label: '1"=10\'', feetPerDrawingInch: 10 },
  { label: '1"=20\'', feetPerDrawingInch: 20 },
  { label: '1"=30\'', feetPerDrawingInch: 30 },
  { label: '1"=40\'', feetPerDrawingInch: 40 },
];

// PDFs are authored at true sheet size (1 point = 1/72"). Images carry no
// physical size, so we assume standard 96-DPI screen pixels.
export const IMAGE_ASSUMED_DPI = 96;

// Real feet represented by one pixel of the rendered drawing, given:
//   - sheetInchesWide: physical width of the drawing in inches
//       PDF:   pageWidthPoints / 72
//       image: naturalWidthPixels / 96
//   - renderWidth:     the pixel width the drawing was rendered at (the space
//                      measurement points are stored in)
//   - feetPerDrawingInch: from the chosen scale
export function feetPerPixel(
  sheetInchesWide: number,
  renderWidth: number,
  feetPerDrawingInch: number,
): number {
  if (renderWidth <= 0) return 0;
  const drawingInchesPerPixel = sheetInchesWide / renderWidth;
  return drawingInchesPerPixel * feetPerDrawingInch;
}

export type Point = { x: number; y: number };

// Total length of a polyline (in the same pixel space renderWidth is in).
export function polylinePixels(points: Point[], closed = false): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  if (closed && points.length > 2) {
    const a = points[points.length - 1];
    const b = points[0];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

// Render feet as feet-and-inches, e.g. 12.5 → 12' 6".
export function formatFeet(feet: number): string {
  if (!Number.isFinite(feet)) return "—";
  const whole = Math.floor(feet);
  const inches = Math.round((feet - whole) * 12);
  if (inches === 12) return `${whole + 1}' 0"`;
  return `${whole}' ${inches}"`;
}
