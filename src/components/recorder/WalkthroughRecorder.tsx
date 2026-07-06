"use client";

import { useEffect, useRef, useState } from "react";

type CapturedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  offsetSeconds: number;
};

type Phase = "idle" | "recording" | "review";

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WalkthroughRecorder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingOffsetRef = useRef(0);

  useEffect(() => {
    return () => {
      // Release mic and preview memory if the user navigates away
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(
        stream,
        pickMimeType() ? { mimeType: pickMimeType() } : undefined,
      );
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(1000); // gather data every second
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 250);
      setPhase("recording");
    } catch {
      setError(
        "Microphone access was denied. Allow mic access in your browser settings and try again.",
      );
    }
  }

  function stopRecording() {
    setDuration((Date.now() - startedAtRef.current) / 1000);
    if (tickRef.current) clearInterval(tickRef.current);
    recorderRef.current?.stop();
    setPhase("review");
  }

  function handleAddPhotoClick() {
    // Stamp the offset at tap time — closest to what the contractor was
    // narrating — not when the camera returns the file.
    pendingOffsetRef.current = (Date.now() - startedAtRef.current) / 1000;
    fileInputRef.current?.click();
  }

  function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        offsetSeconds: pendingOffsetRef.current,
      },
    ]);
    e.target.value = ""; // allow snapping again immediately
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function discard() {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setPhotos([]);
    setAudioUrl(null);
    setTitle("");
    setElapsed(0);
    setPhase("idle");
  }

  if (phase === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-4 py-20 text-center">
        <div>
          <h1 className="text-2xl font-bold">Ready to walk the job?</h1>
          <p className="mt-2 text-sm text-white/60">
            Hit record, narrate what you see, and snap photos as you go.
            We&apos;ll turn it into a report.
          </p>
        </div>
        <button
          onClick={startRecording}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand/85"
        >
          <span className="h-8 w-8 rounded-full bg-white" />
        </button>
        <p className="text-xs text-white/40">Tap to start recording</p>
        {error && <p className="max-w-sm text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="flex flex-col items-center gap-8 px-4 py-12">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-4xl font-bold tabular-nums">
            {formatTime(elapsed)}
          </span>
        </div>

        <p className="text-center text-sm text-white/60">
          Walk and talk — describe what you&apos;re seeing.
          <br />
          Snap a photo whenever you&apos;re talking about something visible.
        </p>

        <button
          onClick={handleAddPhotoClick}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-navy px-6 py-5 text-lg font-semibold ring-1 ring-white/10 transition hover:ring-brand"
        >
          📷 Snap photo
          {photos.length > 0 && (
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-sm">
              {photos.length}
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelected}
        />

        {photos.length > 0 && (
          <div className="flex w-full max-w-xs gap-2 overflow-x-auto">
            {photos.map((p) => (
              <div key={p.id} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt={`Photo at ${formatTime(p.offsetSeconds)}`}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 font-mono text-[10px]">
                  {formatTime(p.offsetSeconds)}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={stopRecording}
          className="rounded-xl bg-red-600 px-8 py-4 font-semibold text-white transition hover:bg-red-500"
        >
          ■ Stop walkthrough
        </button>
      </div>
    );
  }

  // review phase
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Walkthrough captured</h1>
        <p className="mt-1 text-sm text-white/60">
          {formatTime(duration)} of audio · {photos.length} photo
          {photos.length === 1 ? "" : "s"}
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Job name
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Smith residence — roof inspection"
          className="w-full rounded-lg border border-white/10 bg-navy px-4 py-3 text-foreground placeholder-white/40 focus:border-brand focus:outline-none"
        />
      </label>

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full">
          Your browser can&apos;t play this recording.
        </audio>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={`Photo at ${formatTime(p.offsetSeconds)}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 font-mono text-[10px]">
                {formatTime(p.offsetSeconds)}
              </span>
              <button
                onClick={() => removePhoto(p.id)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-brand/40 bg-navy p-3 text-sm text-white/60">
        Upload &amp; report generation land in the next build step — for now
        this screen proves out the capture flow.
      </div>

      <div className="flex gap-3">
        <button
          onClick={discard}
          className="flex-1 rounded-lg border border-white/10 px-4 py-3 font-semibold text-white/80 transition hover:border-red-500 hover:text-red-400"
        >
          Discard
        </button>
        <button
          disabled
          title="Coming in the next step"
          className="flex-1 cursor-not-allowed rounded-lg bg-brand px-4 py-3 font-semibold text-white opacity-50"
        >
          Generate report
        </button>
      </div>
    </div>
  );
}
