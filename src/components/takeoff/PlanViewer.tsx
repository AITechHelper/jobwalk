"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import {
  feetPerPixel as computeFeetPerPixel,
  formatFeet,
  IMAGE_ASSUMED_DPI,
  polylinePixels,
  SCALE_OPTIONS,
  type Point,
} from "@/lib/scale";

type Measurement = {
  id: string;
  label: string | null;
  points: Point[];
  lengthFeet: number | null;
  isClosed: boolean;
};

type PlanData = {
  id: string;
  name: string;
  blobUrl: string;
  fileType: string;
  scaleLabel: string | null;
  feetPerPixel: number | null;
  renderWidth: number | null;
  pageNumber: number;
};

type Mode = "segment" | "polyline" | "pan";

const DEFAULT_BASE_WIDTH = 1400;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 12;

export default function PlanViewer({
  canEdit,
  plan,
  initialMeasurements,
}: {
  canEdit: boolean;
  plan: PlanData;
  initialMeasurements: Measurement[];
}) {
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Base coordinate space (what points are stored in) and physical width.
  const [base, setBase] = useState<{
    width: number;
    height: number;
    sheetInchesWide: number;
  } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [scaleLabel, setScaleLabel] = useState(plan.scaleLabel ?? "");
  const [feetPerPixel, setFeetPerPixel] = useState<number | null>(
    plan.feetPerPixel,
  );

  const [mode, setMode] = useState<Mode>("segment");
  const [measurements, setMeasurements] = useState<Measurement[]>(
    initialMeasurements,
  );
  const [draft, setDraft] = useState<Point[]>([]); // committed draft vertices
  const [live, setLive] = useState<Point | null>(null); // moving endpoint
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Load and render the plan (PDF via pdf.js, or an image) into the canvas.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      setLoadError(null);
      try {
        const targetWidth = plan.renderWidth ?? DEFAULT_BASE_WIDTH;

        if (plan.fileType === "pdf") {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();

          const doc = await pdfjs.getDocument({ url: plan.blobUrl }).promise;
          const page = await doc.getPage(plan.pageNumber || 1);
          const unscaled = page.getViewport({ scale: 1 });
          const pageWidthPoints = unscaled.width;
          const renderScale = targetWidth / pageWidthPoints;
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = canvasRef.current;
          if (!canvas || cancelled) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;

          if (cancelled) return;
          setBase({
            width: canvas.width,
            height: canvas.height,
            sheetInchesWide: pageWidthPoints / 72,
          });
        } else {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("image load failed"));
            img.src = plan.blobUrl;
          });
          if (cancelled) return;
          const naturalWidth = img.naturalWidth || targetWidth;
          const width = plan.renderWidth ?? Math.min(naturalWidth, 1600);
          const height = Math.round(img.naturalHeight * (width / naturalWidth));

          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          setBase({
            width,
            height,
            sheetInchesWide: naturalWidth / IMAGE_ASSUMED_DPI,
          });
        }
      } catch (err) {
        console.error("[plan] render failed:", err);
        if (!cancelled) setLoadError("Couldn't render this plan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [plan.blobUrl, plan.fileType, plan.pageNumber, plan.renderWidth]);

  // Fit-to-width once the base size and viewport are known.
  useEffect(() => {
    if (!base || !viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    setZoom(Math.min(1, vw / base.width));
    setPan({ x: 0, y: 0 });
  }, [base]);

  // -------------------------------------------------------------------------
  // Scale selection → calibrate feet-per-pixel and persist.
  // -------------------------------------------------------------------------
  async function selectScale(label: string) {
    setScaleLabel(label);
    setError(null);
    const opt = SCALE_OPTIONS.find((o) => o.label === label);
    if (!opt || !base) {
      setFeetPerPixel(null);
      return;
    }
    const fpp = computeFeetPerPixel(
      base.sheetInchesWide,
      base.width,
      opt.feetPerDrawingInch,
    );
    setFeetPerPixel(fpp);
    if (!canEdit) return;
    try {
      await fetch(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scaleLabel: label,
          feetPerPixel: fpp,
          renderWidth: base.width,
        }),
      });
    } catch {
      setError("Couldn't save the scale — check your connection.");
    }
  }

  // -------------------------------------------------------------------------
  // Pointer interaction: pinch zoom/pan + measure (segment / polyline).
  // -------------------------------------------------------------------------
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<
    | null
    | { dist: number; mid: { x: number; y: number }; zoom: number; pan: { x: number; y: number } }
  >(null);
  const panRef = useRef<null | { x: number; y: number }>(null);
  const downRef = useRef<null | { client: { x: number; y: number }; base: Point | null }>(
    null,
  );
  const segmentRef = useRef<null | { start: Point }>(null);
  const suppressRef = useRef(false);

  const toBase = useCallback((clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  function viewportPoint(clientX: number, clientY: number) {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function midpoint() {
    const pts = Array.from(pointers.current.values());
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  }
  function distance() {
    const pts = Array.from(pointers.current.values());
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      // Two fingers → pinch/pan; abandon any single-finger measure in progress.
      segmentRef.current = null;
      panRef.current = null;
      downRef.current = null;
      setLive(null);
      const midV = viewportPoint(midpoint().x, midpoint().y);
      pinchRef.current = {
        dist: distance(),
        mid: midV,
        zoom,
        pan,
      };
      return;
    }

    if (pointers.current.size !== 1) return;
    downRef.current = {
      client: { x: e.clientX, y: e.clientY },
      base: toBase(e.clientX, e.clientY),
    };
    if (mode === "pan" || !canEdit || !feetPerPixel) {
      panRef.current = { x: e.clientX, y: e.clientY };
    } else if (mode === "segment") {
      const b = toBase(e.clientX, e.clientY);
      if (b) {
        segmentRef.current = { start: b };
        setLive(b);
      }
    }
    // polyline taps are resolved on pointerup
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchRef.current && pointers.current.size >= 2) {
      const start = pinchRef.current;
      const newDist = distance();
      const ratio = newDist / (start.dist || 1);
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * ratio));
      // Keep the content point under the initial midpoint fixed while the
      // midpoint itself is free to move (two-finger pan).
      const c = {
        x: (start.mid.x - start.pan.x) / start.zoom,
        y: (start.mid.y - start.pan.y) / start.zoom,
      };
      const midV = viewportPoint(midpoint().x, midpoint().y);
      setZoom(newZoom);
      setPan({ x: midV.x - c.x * newZoom, y: midV.y - c.y * newZoom });
      return;
    }

    if (pointers.current.size !== 1) return;

    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }

    if (segmentRef.current) {
      const b = toBase(e.clientX, e.clientY);
      if (b) setLive(b);
    } else if (mode === "polyline" && draft.length > 0) {
      const b = toBase(e.clientX, e.clientY);
      if (b) setLive(b);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasPinch = pointers.current.size >= 2;
    pointers.current.delete(e.pointerId);

    if (wasPinch) {
      pinchRef.current = null;
      // Ignore the trailing single finger so it doesn't start a measurement.
      suppressRef.current = true;
      if (pointers.current.size === 0) suppressRef.current = false;
      return;
    }
    if (suppressRef.current) {
      if (pointers.current.size === 0) suppressRef.current = false;
      return;
    }

    if (panRef.current) {
      panRef.current = null;
      downRef.current = null;
      return;
    }

    const down = downRef.current;
    downRef.current = null;

    if (segmentRef.current) {
      const start = segmentRef.current.start;
      segmentRef.current = null;
      const end = toBase(e.clientX, e.clientY);
      setLive(null);
      if (end && down) {
        const movedClient = Math.hypot(
          e.clientX - down.client.x,
          e.clientY - down.client.y,
        );
        if (movedClient > 6) {
          void saveMeasurement([start, end], false);
        }
      }
      return;
    }

    // Polyline: a tap adds a vertex.
    if (mode === "polyline" && canEdit && feetPerPixel && down?.base) {
      const movedClient = down
        ? Math.hypot(e.clientX - down.client.x, e.clientY - down.client.y)
        : 0;
      if (movedClient <= 8) {
        setDraft((d) => [...d, down.base as Point]);
        setLive(null);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Persist / mutate measurements
  // -------------------------------------------------------------------------
  async function saveMeasurement(points: Point[], isClosed: boolean) {
    if (!feetPerPixel) {
      setError("Pick a scale first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, isClosed }),
      });
      if (!res.ok) throw new Error();
      const { measurement } = await res.json();
      setMeasurements((m) => [...m, measurement]);
      setDraft([]);
      setLive(null);
    } catch {
      setError("Couldn't save the measurement.");
    } finally {
      setSaving(false);
    }
  }

  function finishPolyline(close: boolean) {
    if (draft.length < 2) {
      setDraft([]);
      setLive(null);
      return;
    }
    void saveMeasurement(draft, close);
  }

  async function deleteMeasurement(measurementId: string) {
    setMeasurements((m) => m.filter((x) => x.id !== measurementId));
    try {
      await fetch(
        `/api/plans/${plan.id}/measurements?measurementId=${measurementId}`,
        { method: "DELETE" },
      );
    } catch {
      router.refresh();
    }
  }

  async function renameMeasurement(measurementId: string, label: string) {
    // Labels are edited client-side; persisted via a lightweight re-save would
    // require an endpoint — kept local for v1 display. (Length is authoritative.)
    setMeasurements((m) =>
      m.map((x) => (x.id === measurementId ? { ...x, label } : x)),
    );
  }

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------
  const draftPreview: Point[] =
    segmentRef.current && live
      ? [segmentRef.current.start, live]
      : mode === "polyline"
        ? live
          ? [...draft, live]
          : draft
        : [];

  const draftFeet =
    feetPerPixel && draftPreview.length >= 2
      ? polylinePixels(draftPreview, false) * feetPerPixel
      : null;

  const totalFeet = measurements.reduce(
    (sum, m) =>
      sum +
      (feetPerPixel
        ? polylinePixels(m.points, m.isClosed) * feetPerPixel
        : m.lengthFeet ?? 0),
    0,
  );

  function measurementFeet(m: Measurement): number {
    return feetPerPixel
      ? polylinePixels(m.points, m.isClosed) * feetPerPixel
      : m.lengthFeet ?? 0;
  }

  const strokeW = base ? Math.max(1.5, base.width / 500) / zoom : 2;
  const vertexR = base ? Math.max(2.5, base.width / 300) / zoom : 3;
  const fontSize = base ? Math.max(11, base.width / 90) / zoom : 12;

  return (
    <div className="mt-3">
      <h1 className="text-2xl font-bold">{plan.name}</h1>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-white/50">Scale</span>
          <select
            value={scaleLabel}
            onChange={(e) => selectScale(e.target.value)}
            disabled={!canEdit}
            className="rounded-lg border border-white/10 bg-navy px-3 py-2 text-foreground focus:border-brand focus:outline-none disabled:opacity-60"
          >
            <option value="">Select…</option>
            {SCALE_OPTIONS.map((o) => (
              <option key={o.label} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {canEdit && (
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {(
              [
                ["segment", "Segment"],
                ["polyline", "Polyline"],
                ["pan", "Pan"],
              ] as [Mode, string][]
            ).map(([m, labelText]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setDraft([]);
                  setLive(null);
                }}
                disabled={!feetPerPixel && m !== "pan"}
                className={`px-3 py-2 text-sm font-semibold transition ${
                  mode === m
                    ? "bg-brand text-white"
                    : "text-white/60 hover:text-white disabled:opacity-40"
                }`}
              >
                {labelText}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}
            className="h-8 w-8 rounded-lg border border-white/10 text-white/70 hover:text-white"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={() => {
              if (!base || !viewportRef.current) return;
              setZoom(
                Math.min(1, viewportRef.current.clientWidth / base.width),
              );
              setPan({ x: 0, y: 0 });
            }}
            className="h-8 rounded-lg border border-white/10 px-2 text-xs text-white/70 hover:text-white"
          >
            Fit
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}
            className="h-8 w-8 rounded-lg border border-white/10 text-white/70 hover:text-white"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {!feetPerPixel && (
        <p className="mt-2 text-sm text-amber-400/80">
          Pick a scale to start measuring.
        </p>
      )}
      {feetPerPixel && canEdit && (
        <p className="mt-2 text-xs text-white/40">
          {mode === "segment"
            ? "Press and drag across a wall to measure it."
            : mode === "polyline"
              ? "Tap each corner, then Finish. Two fingers to zoom/pan."
              : "Drag to pan. Two fingers to zoom."}
        </p>
      )}

      {/* Polyline finish controls */}
      {mode === "polyline" && draft.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-white/60">
            {draft.length} point{draft.length === 1 ? "" : "s"}
            {draftFeet != null && <> · {formatFeet(draftFeet)}</>}
          </span>
          <button
            onClick={() => setDraft((d) => d.slice(0, -1))}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:text-white"
          >
            Undo point
          </button>
          <button
            onClick={() => finishPolyline(false)}
            disabled={draft.length < 2 || saving}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand/85 disabled:opacity-50"
          >
            Finish
          </button>
          <button
            onClick={() => finishPolyline(true)}
            disabled={draft.length < 3 || saving}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-50"
          >
            Close loop
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {/* Viewer */}
      <div
        ref={viewportRef}
        className="relative mt-3 h-[60vh] w-full touch-none select-none overflow-hidden rounded-xl border border-white/10 bg-neutral-900"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <Spinner className="h-8 w-8" />
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-red-400">
            {loadError}
          </div>
        )}

        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: base?.width,
            height: base?.height,
          }}
        >
          <canvas ref={canvasRef} className="block" />
          {base && (
            <svg
              ref={svgRef}
              className="absolute left-0 top-0"
              width={base.width}
              height={base.height}
              viewBox={`0 0 ${base.width} ${base.height}`}
            >
              {measurements.map((m) => (
                <MeasurementShape
                  key={m.id}
                  points={m.points}
                  isClosed={m.isClosed}
                  label={m.label ?? formatFeet(measurementFeet(m))}
                  color="#3385ff"
                  strokeW={strokeW}
                  vertexR={vertexR}
                  fontSize={fontSize}
                />
              ))}
              {draftPreview.length >= 2 && (
                <MeasurementShape
                  points={draftPreview}
                  isClosed={false}
                  label={draftFeet != null ? formatFeet(draftFeet) : ""}
                  color="#f59e0b"
                  strokeW={strokeW}
                  vertexR={vertexR}
                  fontSize={fontSize}
                  dashed
                />
              )}
              {mode === "polyline" &&
                draft.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={vertexR * 1.5}
                    fill="#f59e0b"
                  />
                ))}
            </svg>
          )}
        </div>
      </div>

      {/* Measurement list */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">
            Measurements ({measurements.length})
          </h2>
          {measurements.length > 0 && feetPerPixel && (
            <span className="text-sm font-semibold">
              Total: {formatFeet(totalFeet)}
            </span>
          )}
        </div>

        {measurements.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">
            No measurements yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {measurements.map((m, i) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-lg bg-navy/50 px-3 py-2 text-sm"
              >
                <span className="w-6 text-white/40">{i + 1}</span>
                {canEdit ? (
                  <input
                    value={m.label ?? ""}
                    onChange={(e) => renameMeasurement(m.id, e.target.value)}
                    placeholder={`Wall ${i + 1}`}
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-white/20 focus:outline-none"
                  />
                ) : (
                  <span className="min-w-0 flex-1">
                    {m.label ?? `Wall ${i + 1}`}
                  </span>
                )}
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatFeet(measurementFeet(m))}
                  {m.isClosed && (
                    <span className="ml-1 text-xs font-normal text-white/40">
                      (loop)
                    </span>
                  )}
                </span>
                {canEdit && (
                  <button
                    onClick={() => deleteMeasurement(m.id)}
                    className="shrink-0 text-white/40 hover:text-red-400"
                    aria-label="Delete measurement"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// A polyline/polygon measurement with vertex dots and a length label at its
// midpoint, drawn in the plan's base coordinate space.
function MeasurementShape({
  points,
  isClosed,
  label,
  color,
  strokeW,
  vertexR,
  fontSize,
  dashed,
}: {
  points: Point[];
  isClosed: boolean;
  label: string;
  color: string;
  strokeW: number;
  vertexR: number;
  fontSize: number;
  dashed?: boolean;
}) {
  if (points.length < 2) return null;
  const pts = points.map((p) => `${p.x},${p.y}`).join(" ");
  const mid = points[Math.floor(points.length / 2) - 1] ?? points[0];
  const next = points[Math.floor(points.length / 2)] ?? points[1];
  const labelX = (mid.x + next.x) / 2;
  const labelY = (mid.y + next.y) / 2;

  return (
    <g>
      {isClosed ? (
        <polygon
          points={pts}
          fill={`${color}22`}
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={dashed ? `${strokeW * 3} ${strokeW * 2}` : undefined}
        />
      ) : (
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? `${strokeW * 3} ${strokeW * 2}` : undefined}
        />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={vertexR} fill={color} />
      ))}
      {label && (
        <text
          x={labelX}
          y={labelY - vertexR * 2}
          fontSize={fontSize}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={fontSize / 12}
          paintOrder="stroke"
          textAnchor="middle"
          fontWeight="700"
        >
          {label}
        </text>
      )}
    </g>
  );
}
