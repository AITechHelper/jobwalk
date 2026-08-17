"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Spinner from "@/components/ui/Spinner";

// A freehand stroke. Points are normalized 0..1 against the image so the markup
// scales to any display size and can be reopened for editing.
type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ffffff", "#111827"];
const WIDTHS = [3, 6, 12];

// Full-screen markup editor for one report photo. Draws over the ORIGINAL
// image; on save it flattens the strokes onto a copy, uploads that as a new
// blob, and stores the strokes for re-editing — the original is never touched.
// Built on pointer events so mouse and touch behave identically.
export default function PhotoAnnotator({
  reportId,
  photo,
  onClose,
}: {
  reportId: string;
  photo: { id: string; blobUrl: string; annotation: Stroke[] | null };
  onClose: () => void;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const [strokes, setStrokes] = useState<Stroke[]>(photo.annotation ?? []);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redraw all strokes (committed + in-progress) at the current display size.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = current ? [...strokes, current] : strokes;
    for (const s of all) {
      if (s.points.length === 0) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * size.w;
        const y = p.y * size.h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      // A single tap draws a dot.
      if (s.points.length === 1) {
        ctx.lineTo(s.points[0].x * size.w + 0.1, s.points[0].y * size.h);
      }
      ctx.stroke();
    }
  }, [strokes, current, size]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Match the canvas to the rendered image size, and keep it in sync on resize.
  const syncSize = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.clientWidth) return;
    setSize({ w: img.clientWidth, h: img.clientHeight });
  }, []);

  useEffect(() => {
    window.addEventListener("resize", syncSize);
    return () => window.removeEventListener("resize", syncSize);
  }, [syncSize]);

  function toNorm(e: React.PointerEvent): Point | null {
    const canvas = canvasRef.current;
    if (!canvas || !size) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toNorm(e);
    if (!p) return;
    drawingRef.current = true;
    setCurrent({ color, width, points: [p] });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const p = toNorm(e);
    if (!p) return;
    setCurrent((c) => (c ? { ...c, points: [...c.points, p] } : c));
  }
  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setCurrent((c) => {
      if (c && c.points.length > 0) setStrokes((s) => [...s, c]);
      return null;
    });
  }

  function undo() {
    setStrokes((s) => s.slice(0, -1));
  }
  function clearAll() {
    setStrokes([]);
  }

  async function save() {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    setError(null);
    try {
      // Flatten strokes onto a copy at the image's natural resolution.
      const natW = img.naturalWidth || img.clientWidth;
      const natH = img.naturalHeight || img.clientHeight;
      const off = document.createElement("canvas");
      off.width = natW;
      off.height = natH;
      const ctx = off.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.drawImage(img, 0, 0, natW, natH);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of strokes) {
        if (s.points.length === 0) continue;
        // Scale the display-space width to natural resolution.
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * (natW / (size?.w || natW));
        ctx.beginPath();
        s.points.forEach((p, i) => {
          const x = p.x * natW;
          const y = p.y * natH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (s.points.length === 1) {
          ctx.lineTo(s.points[0].x * natW + 0.1, s.points[0].y * natH);
        }
        ctx.stroke();
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        off.toBlob((b) => resolve(b), "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("export failed");

      const result = await upload(
        `reports/${reportId}/annotated/${photo.id}-${Date.now()}.jpg`,
        blob,
        { access: "public", handleUploadUrl: "/api/upload" },
      );

      const res = await fetch(`/api/reports/${reportId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photo.id,
          annotatedBlobUrl: result.url,
          annotation: strokes,
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      onClose();
    } catch {
      setError("Couldn't save the markup. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 print:hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-3">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`h-7 w-7 rounded-full border-2 ${
                color === c ? "border-white" : "border-white/20"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="ml-1 flex items-center gap-1.5">
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              aria-label={`Brush ${w}`}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                width === w ? "border-white bg-white/10" : "border-white/20"
              }`}
            >
              <span
                className="rounded-full bg-white"
                style={{ width: w, height: w }}
              />
            </button>
          ))}
        </div>
        <button
          onClick={undo}
          disabled={strokes.length === 0}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/80 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={clearAll}
          disabled={strokes.length === 0}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/80 disabled:opacity-40"
        >
          Clear
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand/85 disabled:opacity-50"
          >
            {saving && <Spinner className="h-4 w-4" />}
            Save markup
          </button>
        </div>
      </div>

      {error && <p className="pb-2 text-sm text-red-400">{error}</p>}

      {/* Canvas stage */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div ref={wrapRef} className="relative max-h-full max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={photo.blobUrl}
            alt=""
            crossOrigin="anonymous"
            onLoad={syncSize}
            className="max-h-[80vh] max-w-full touch-none select-none object-contain"
          />
          {size && (
            <canvas
              ref={canvasRef}
              width={size.w}
              height={size.h}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute left-0 top-0 h-full w-full touch-none"
              style={{ cursor: "crosshair" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
