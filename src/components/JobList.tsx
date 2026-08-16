"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import LocalDate from "@/components/LocalDate";
import Spinner from "@/components/ui/Spinner";

export type JobListItem = {
  id: string;
  title: string;
  status: string;
  createdAt: string; // ISO
};

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  recording: { label: "Draft", classes: "bg-white/10 text-white/60" },
  uploading: { label: "Uploading", classes: "bg-white/10 text-white/60" },
  processing: { label: "Processing", classes: "bg-brand/20 text-brand" },
  ready: { label: "Ready", classes: "bg-brand/20 text-brand" },
  failed: { label: "Failed", classes: "bg-red-500/20 text-red-400" },
};

const REVEAL = 88; // px of red Delete panel exposed when a row is swiped open

export default function JobList({ jobs }: { jobs: JobListItem[] }) {
  const [items, setItems] = useState(jobs);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);

  const start = useRef({ x: 0, y: 0 });
  const dir = useRef<null | "h" | "v">(null);
  const moved = useRef(false);

  function onTouchStart(id: string, e: React.TouchEvent) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dir.current = null;
    moved.current = false;
    setDragId(id);
    setDragX(openId === id ? -REVEAL : 0);
  }

  function onTouchMove(id: string, e: React.TouchEvent) {
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (dir.current === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        dir.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      }
    }
    if (dir.current !== "h") return; // let vertical gestures scroll
    moved.current = true;
    const base = openId === id ? -REVEAL : 0;
    setDragX(Math.max(-REVEAL - 16, Math.min(0, base + dx)));
  }

  function onTouchEnd(id: string) {
    if (dir.current === "h") {
      setOpenId(dragX < -REVEAL / 2 ? id : null);
    }
    setDragId(null);
    setDragX(0);
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      setItems((prev) => prev.filter((j) => j.id !== id));
      setOpenId(null);
    } catch {
      setDeletingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-16 text-center text-white/60">
        No walkthroughs left.
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-3">
      {items.map((job) => {
        const status = STATUS_LABELS[job.status] ?? STATUS_LABELS.recording;
        const offset =
          dragId === job.id ? dragX : openId === job.id ? -REVEAL : 0;
        return (
          <li
            key={job.id}
            className="relative overflow-hidden rounded-xl"
            style={{ touchAction: "pan-y" }}
          >
            {/* Red Delete panel revealed underneath */}
            <button
              onClick={() => remove(job.id)}
              disabled={deletingId === job.id}
              aria-label={`Delete ${job.title}`}
              className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600 px-5 text-sm font-semibold text-white"
              style={{ width: REVEAL + 16 }}
            >
              {deletingId === job.id ? <Spinner /> : "Delete"}
            </button>

            {/* Foreground card slides to reveal it */}
            <Link
              href={`/jobs/${job.id}`}
              onClick={(e) => {
                // A swipe (or an open row) shouldn't navigate — it should just
                // settle/close the row instead.
                if (openId === job.id || moved.current) {
                  e.preventDefault();
                  setOpenId(null);
                }
              }}
              onTouchStart={(e) => onTouchStart(job.id, e)}
              onTouchMove={(e) => onTouchMove(job.id, e)}
              onTouchEnd={() => onTouchEnd(job.id)}
              className="relative flex items-center justify-between gap-3 border border-white/10 bg-navy p-4 transition-transform"
              style={{
                transform: `translateX(${offset}px)`,
                transition: dragId === job.id ? "none" : "transform 0.2s ease",
              }}
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{job.title}</p>
                <p className="mt-0.5 text-sm text-white/60">
                  <LocalDate iso={job.createdAt} />
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${status.classes}`}
              >
                {status.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
