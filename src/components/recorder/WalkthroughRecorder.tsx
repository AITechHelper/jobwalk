"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Spinner from "@/components/ui/Spinner";

type CapturedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  offsetSeconds: number;
};

type Phase = "idle" | "recording" | "review" | "submitting";

// Persisted once the user agrees to send their walkthrough to the AI providers.
// Apple 5.1.1/5.1.2 require explicit permission before sharing personal data
// with a third-party AI service.
// Consent is recorded per *user* (Clerk publicMetadata.aiConsentAt), not per
// device. An earlier version kept it in localStorage, which meant one person
// agreeing on a device silently consented every later account on that same
// device — so a fresh reviewer account could skip the disclosure entirely.
// The signed-in user's consent state is passed in from the server.

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WalkthroughRecorder({
  initialConsent,
  jobs = [],
  preselectedJobId = null,
}: {
  initialConsent: boolean;
  jobs?: { id: string; name: string }[];
  preselectedJobId?: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [jobId, setJobId] = useState<string>(preselectedJobId ?? "");
  const [submitStep, setSubmitStep] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [flash, setFlash] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [consented, setConsented] = useState(initialConsent);
  const [savingConsent, setSavingConsent] = useState(false);

  const audioBlobRef = useRef<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Attach the live camera stream to the preview once the recording view mounts.
  useEffect(() => {
    if (phase === "recording" && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.muted = true;
      video.play().catch(() => {});
    }
  }, [phase]);

  async function startRecording() {
    setError(null);
    setStarting(true);
    try {
      // One stream for both: audio feeds the recorder, video feeds the live
      // preview + instant photo capture.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      // Record audio only — the report is text-based, no video is uploaded.
      const audioStream = new MediaStream(stream.getAudioTracks());
      const recorder = new MediaRecorder(
        audioStream,
        pickMimeType() ? { mimeType: pickMimeType() } : undefined,
      );
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Strip any codec suffix so the type is a clean base (e.g.
        // "audio/mp4;codecs=..." → "audio/mp4") for a reliable extension.
        const cleanType = (recorder.mimeType || "audio/mp4").split(";")[0];
        audioBlobRef.current = new Blob(chunksRef.current, { type: cleanType });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 250);
      setPhase("recording");
    } catch {
      setError(
        "JobWalk needs camera and microphone access to record a walkthrough. Allow both in your settings and try again.",
      );
    } finally {
      setStarting(false);
    }
  }

  function snapPhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Stamp the offset the instant the shutter is tapped.
    const offsetSeconds = (Date.now() - startedAtRef.current) / 1000;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setFlash(true);
    setTimeout(() => setFlash(false), 120);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPhotos((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(blob),
            offsetSeconds,
          },
        ]);
      },
      "image/jpeg",
      0.85,
    );
  }

  async function stopRecording() {
    setStopping(true);
    // Stopping the recorder/camera stream can briefly block the main thread
    // on iOS; yield a couple frames first so the spinner actually paints
    // instead of the button looking frozen for that gap.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    setDuration((Date.now() - startedAtRef.current) / 1000);
    if (tickRef.current) clearInterval(tickRef.current);
    recorderRef.current?.stop();
    setPhase("review");
    setStopping(false);
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
    audioBlobRef.current = null;
    setPhotos([]);
    setTitle("");
    setElapsed(0);
    setPhase("idle");
  }

  // Gate report generation behind explicit AI-sharing consent. The first time,
  // show the disclosure sheet; once agreed, generate straight away thereafter.
  function requestGenerate() {
    if (!title.trim()) return;
    if (consented) {
      generateReport();
    } else {
      setShowConsent(true);
    }
  }

  // Records consent against the signed-in user so it follows the account, not
  // the device. Returns false if it couldn't be saved — we never proceed to
  // send data on a consent we failed to record.
  async function saveConsent(): Promise<boolean> {
    setSavingConsent(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-consent", { method: "POST" });
      if (!res.ok) throw new Error(`consent save failed: ${res.status}`);
      setConsented(true);
      return true;
    } catch (err) {
      console.error(err);
      setError("Couldn't save your choice — check your connection and retry.");
      return false;
    } finally {
      setSavingConsent(false);
    }
  }

  async function acceptConsentAndGenerate() {
    if (!(await saveConsent())) return;
    setShowConsent(false);
    generateReport();
  }

  async function generateReport() {
    const audioBlob = audioBlobRef.current;
    if (!audioBlob || !title.trim()) return;
    setPhase("submitting");
    setError(null);
    try {
      setSubmitStep("Creating walkthrough...");
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          projectId: jobId || undefined,
        }),
      });
      if (!jobRes.ok) throw new Error(`job create failed: ${jobRes.status}`);
      const { job } = await jobRes.json();

      setSubmitStep("Uploading recording...");
      const ext =
        audioBlob.type.includes("mp4") || audioBlob.type.includes("m4a")
          ? "mp4"
          : "webm";
      const audioBlobResult = await upload(
        `jobs/${job.id}/audio.${ext}`,
        audioBlob,
        { access: "public", handleUploadUrl: "/api/upload" },
      );

      const uploadedPhotos: { url: string; offsetSeconds: number }[] = [];
      for (let i = 0; i < photos.length; i++) {
        setSubmitStep(`Uploading photo ${i + 1} of ${photos.length}...`);
        const result = await upload(
          `jobs/${job.id}/photo-${i}.jpg`,
          photos[i].file,
          { access: "public", handleUploadUrl: "/api/upload" },
        );
        uploadedPhotos.push({
          url: result.url,
          offsetSeconds: photos[i].offsetSeconds,
        });
      }

      setSubmitStep("Generating your report — this takes a minute or two...");
      const finalizeRes = await fetch(`/api/jobs/${job.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrl: audioBlobResult.url,
          durationSeconds: duration,
          photos: uploadedPhotos,
        }),
      });

      router.push(`/jobs/${job.id}`);
      if (!finalizeRes.ok) return;
    } catch (err) {
      console.error(err);
      setError(
        "Something went wrong saving your walkthrough. Your recording is still here — try again.",
      );
      setPhase("review");
    }
  }

  // Consent gate. Shown before anything can be recorded, so permission is
  // obtained before any personal data is captured or sent to an AI provider
  // (App Store guidelines 5.1.1(i) / 5.1.2(i)). This is deliberately the first
  // screen a new user sees after signing in — it must not be reachable only
  // deep in the flow.
  if (phase === "idle" && !consented) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-5 px-5 py-8">
        <div>
          <h1 className="text-2xl font-bold">How JobWalk creates your report</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            Before you record, here&apos;s exactly what happens to your data.
            We need your permission first.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-navy p-5">
          <div>
            <h2 className="text-sm font-semibold text-white">
              What we send
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/70">
              The <strong className="text-white">audio you record</strong> and
              the <strong className="text-white">photos you take</strong> during
              a walkthrough.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">Who we send it to</h2>
            <ul className="mt-1 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                <strong className="text-white">OpenAI</strong> — transcribes
                your audio recording into text.
              </li>
              <li>
                <strong className="text-white">Anthropic</strong> — uses that
                transcript and your photos to write the report.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">How it&apos;s used</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/70">
              Only to generate your report. Your recordings and photos are never
              sold, and are never used to train AI models. Both providers are
              contractually required to protect your data to the same standard
              we do.
            </p>
          </div>

          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand underline"
          >
            Read our full Privacy Policy
          </a>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={saveConsent}
          disabled={savingConsent}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85 disabled:opacity-70"
        >
          {savingConsent && <Spinner className="h-4 w-4" />}
          I agree — send my recordings to create reports
        </button>
        <p className="text-center text-xs leading-relaxed text-white/40">
          You can&apos;t create reports without agreeing, since the report is
          generated by these services. You can delete your data at any time.
        </p>
      </div>
    );
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
          disabled={starting}
          aria-label="Start recording"
          className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-white shadow-lg transition active:scale-95 hover:bg-brand/85 disabled:opacity-70"
        >
          {starting ? (
            <Spinner className="h-9 w-9 border-[3px] text-white" />
          ) : (
            <span className="h-8 w-8 rounded-full bg-white" />
          )}
        </button>
        <p className="text-xs text-white/40">
          {starting ? "Starting camera…" : "Tap to start recording"}
        </p>
        {error && <p className="max-w-sm text-sm text-red-400">{error}</p>}
        <p className="max-w-xs text-xs leading-relaxed text-white/40">
          Your recording and photos are sent to OpenAI and Anthropic to create
          your report.{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/60"
          >
            Learn more
          </a>
        </p>
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 px-3 py-3">
        {/* Fixed-aspect preview + photos overlaid inside it (below) means the
            layout height never grows as photos are taken, so the controls can't
            be pushed under the nav. */}
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-navy">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {flash && <div className="absolute inset-0 bg-white" />}

          {/* timer */}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="font-mono text-sm font-bold tabular-nums text-white">
              {formatTime(elapsed)}
            </span>
          </div>

          {/* photo count */}
          {photos.length > 0 && (
            <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
              {photos.length} 📷
            </div>
          )}

          {/* Photo bank overlaid at the bottom of the preview — it never adds
              layout height, so the shutter can't be pushed off screen. */}
          {photos.length > 0 && (
            <div className="absolute inset-x-0 bottom-0 flex gap-2 overflow-x-auto bg-gradient-to-t from-black/70 to-transparent p-2">
              {photos.map((p) => (
                <div key={p.id} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.previewUrl}
                    alt={`Photo at ${formatTime(p.offsetSeconds)}`}
                    className="h-14 w-14 rounded-lg border border-white/20 object-cover"
                  />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 font-mono text-[10px] text-white">
                    {formatTime(p.offsetSeconds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shutter + Done — pinned in a fixed-height row */}
        <div className="flex shrink-0 items-center justify-between">
          <div className="w-20" />
          <button
            onClick={snapPhoto}
            aria-label="Take photo"
            className="flex h-20 w-20 items-center justify-center rounded-full ring-4 ring-white/80 transition active:scale-95"
          >
            <span className="h-16 w-16 rounded-full bg-white transition active:bg-white/70" />
          </button>
          <button
            onClick={stopRecording}
            disabled={stopping}
            className="flex w-20 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-70"
          >
            {stopping && <Spinner className="h-3.5 w-3.5" />}
            Done
          </button>
        </div>
        <p className="shrink-0 text-center text-xs text-white/40">
          Talk as you walk. Tap the shutter to snap what you&apos;re describing.
        </p>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-brand" />
        <p className="font-semibold">{submitStep}</p>
        <p className="text-sm text-white/60">
          Keep this screen open until it finishes.
        </p>
      </div>
    );
  }

  // review phase
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <div className="text-center">
        <span className="text-3xl">✅</span>
        <h1 className="mt-2 text-2xl font-bold">Name this walkthrough</h1>
        <p className="mt-1 text-sm text-white/60">
          Give it a name, then generate your report.
        </p>
      </div>

      <div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          autoFocus
          enterKeyHint="done"
          placeholder="e.g. Smith residence — roof inspection"
          className="w-full rounded-xl border-2 border-brand/50 bg-navy px-4 py-4 text-lg text-foreground placeholder-white/40 focus:border-brand focus:outline-none"
        />
        <p className="mt-2 text-center text-sm text-white/50">
          {formatTime(duration)} recorded · {photos.length} photo
          {photos.length === 1 ? "" : "s"} captured
        </p>
      </div>

      {jobs.length > 0 && (
        <div>
          <label
            htmlFor="walkthrough-job"
            className="block text-base font-semibold text-white/80"
          >
            Which job is this for?
          </label>
          <select
            id="walkthrough-job"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-navy px-4 py-3.5 text-lg text-foreground focus:border-brand focus:outline-none"
          >
            <option value="">No job — just this walkthrough</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 opacity-80">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt={`Photo at ${formatTime(p.offsetSeconds)}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={discard}
          className="flex-1 rounded-xl border border-white/15 px-4 py-4 text-lg font-semibold text-white/80 transition hover:border-red-500 hover:text-red-400"
        >
          Discard
        </button>
        <button
          onClick={requestGenerate}
          disabled={!title.trim()}
          title={!title.trim() ? "Name the walkthrough first" : undefined}
          className="flex-1 rounded-xl bg-brand px-4 py-4 text-lg font-semibold text-white transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate report
        </button>
      </div>

      {/* Persistent disclosure so it's always clear where the data goes. */}
      <p className="text-center text-xs leading-relaxed text-white/40">
        Generating a report sends your recording and photos to OpenAI and
        Anthropic to create it.{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/60"
        >
          Learn more
        </a>
      </p>

      {showConsent && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-consent-title"
          onClick={() => setShowConsent(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-navy p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-consent-title" className="text-lg font-bold">
              Before we generate your report
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              To create your report, JobWalk sends your{" "}
              <strong className="text-white">audio recording</strong> and{" "}
              <strong className="text-white">photos</strong> to two AI providers:
            </p>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-white/70">
              <li>
                <strong className="text-white">OpenAI</strong> — transcribes
                your audio.
              </li>
              <li>
                <strong className="text-white">Anthropic</strong> — writes the
                report from the transcript and photos.
              </li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              They process this only to generate your report. We don&apos;t sell
              it or use it to train AI models. See our{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline"
              >
                Privacy Policy
              </a>
              .
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={acceptConsentAndGenerate}
                disabled={savingConsent}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3.5 font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85 disabled:opacity-70"
              >
                {savingConsent && <Spinner className="h-4 w-4" />}
                Agree &amp; generate report
              </button>
              <button
                onClick={() => setShowConsent(false)}
                className="rounded-lg px-4 py-3 font-semibold text-white/60 transition hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
