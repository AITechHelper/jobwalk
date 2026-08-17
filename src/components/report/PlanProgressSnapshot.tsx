"use client";

import { useEffect, useRef, useState } from "react";
import Spinner from "@/components/ui/Spinner";
import { centroid } from "@/lib/progress";
import type { Point } from "@/lib/scale";

export type SnapshotMark = {
  points: Point[];
  isClosed: boolean;
  statusLabel: string;
  color: string;
};

// Read-only render of a plan with a set of progress marks overlaid — the
// visual "what got completed" shown inside a daily report. Not interactive;
// renders in the printable report sheet.
export default function PlanProgressSnapshot({
  plan,
  marks,
}: {
  plan: {
    name: string;
    blobUrl: string;
    fileType: string;
    pageNumber: number;
    renderWidth: number | null;
  };
  marks: SnapshotMark[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Stored coordinate space the mark points live in.
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const targetWidth = plan.renderWidth ?? 1400;

    async function render() {
      setLoading(true);
      setFailed(false);
      try {
        if (plan.fileType === "pdf") {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
          const doc = await pdfjs.getDocument({ url: plan.blobUrl }).promise;
          const page = await doc.getPage(plan.pageNumber || 1);
          const unscaled = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: targetWidth / unscaled.width,
          });
          const canvas = canvasRef.current;
          if (!canvas || cancelled) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          setDims({ width: canvas.width, height: canvas.height });
        } else {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("image load failed"));
            img.src = plan.blobUrl;
          });
          if (cancelled) return;
          const natW = img.naturalWidth || targetWidth;
          const width = plan.renderWidth ?? Math.min(natW, 1600);
          const height = Math.round(img.naturalHeight * (width / natW));
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          setDims({ width, height });
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [plan.blobUrl, plan.fileType, plan.pageNumber, plan.renderWidth]);

  // Size strokes/text in stored units so they read ~consistently once the SVG
  // viewBox scales down to the displayed width.
  const s = dims ? dims.width / 900 : 1;
  const stroke = 2.6 * s;
  const font = 13 * s;
  const pinR = 6 * s;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {plan.name}
      </p>
      <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
        {loading && (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {failed && (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
            Couldn&apos;t load this plan.
          </div>
        )}
        <div className="relative">
          <canvas ref={canvasRef} className="block w-full" />
          {dims && (
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${dims.width} ${dims.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {marks.map((m, i) => {
                if (m.points.length === 0) return null;
                const single = m.points.length === 1;
                const c = centroid(m.points);
                const pts = m.points.map((p) => `${p.x},${p.y}`).join(" ");
                const chipY = single ? m.points[0].y - pinR * 2.5 : c.y;
                return (
                  <g key={i}>
                    {single ? (
                      <circle
                        cx={m.points[0].x}
                        cy={m.points[0].y}
                        r={pinR}
                        fill={m.color}
                        stroke="#ffffff"
                        strokeWidth={stroke}
                      />
                    ) : m.isClosed ? (
                      <polygon
                        points={pts}
                        fill={`${m.color}44`}
                        stroke={m.color}
                        strokeWidth={stroke}
                      />
                    ) : (
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={m.color}
                        strokeWidth={stroke * 1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    <text
                      x={c.x}
                      y={chipY}
                      fontSize={font}
                      fill="#111827"
                      stroke="#ffffff"
                      strokeWidth={font / 5}
                      paintOrder="stroke"
                      textAnchor="middle"
                      fontWeight="700"
                    >
                      {m.statusLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
