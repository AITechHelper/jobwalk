"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import LocalDate from "@/components/LocalDate";
import Spinner from "@/components/ui/Spinner";
import WeatherCard from "./WeatherCard";
import ReportComments from "./ReportComments";
import PlanProgressSnapshot, {
  type SnapshotMark,
} from "./PlanProgressSnapshot";
import {
  rowTotalHours,
  totalEquipmentHours,
  totalWorkforceHours,
  type DailyReportBody,
  type EquipmentRow,
  type WorkforceRow,
} from "@/lib/dailyReport";
import type { WeatherData } from "@/lib/weather";

type Area = { id: string; name: string };
type Crew = { id: string; name: string; trade: string | null };
type Activity = { id: string; name: string };
type Photo = {
  id: string;
  blobUrl: string;
  areaId: string | null;
  caption: string | null;
};
type Comment = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

type ReportData = {
  id: string;
  reportDate: string;
  status: "draft" | "completed";
  jobType: "commercial" | "residential";
  reporterName: string | null;
  generalContractor: string | null;
  reviewerName: string | null;
  body: DailyReportBody;
  weather: WeatherData | null;
};

type ProgressPlan = {
  id: string;
  name: string;
  blobUrl: string;
  fileType: string;
  pageNumber: number;
  renderWidth: number | null;
  marks: SnapshotMark[];
};

export default function DailyReportEditor({
  canEdit,
  report,
  project,
  company,
  projectId,
  progressPlans,
  areas,
  crew,
  activities,
  photos,
  comments,
}: {
  canEdit: boolean;
  report: ReportData;
  project: { name: string; siteAddress: string | null; clientName: string | null };
  company: { businessName: string | null; phone: string | null };
  projectId: string;
  progressPlans: ProgressPlan[];
  areas: Area[];
  crew: Crew[];
  activities: Activity[];
  photos: Photo[];
  comments: Comment[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ---- draft state (initialized on entering edit mode) ----
  const [reportDate, setReportDate] = useState(report.reportDate);
  const [jobType, setJobType] = useState(report.jobType);
  const [reporterName, setReporterName] = useState(report.reporterName ?? "");
  const [generalContractor, setGeneralContractor] = useState(
    report.generalContractor ?? "",
  );
  const [reviewerName, setReviewerName] = useState(report.reviewerName ?? "");
  const [body, setBody] = useState<DailyReportBody>(report.body);
  const [statusValue, setStatusValue] = useState(report.status);

  const areaName = (id: string | null) =>
    areas.find((a) => a.id === id)?.name ?? null;

  function startEditing() {
    setReportDate(report.reportDate);
    setJobType(report.jobType);
    setReporterName(report.reporterName ?? "");
    setGeneralContractor(report.generalContractor ?? "");
    setReviewerName(report.reviewerName ?? "");
    setBody(report.body);
    setStatusValue(report.status);
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate,
          status: statusValue,
          jobType,
          reporterName,
          generalContractor,
          reviewerName,
          body,
        }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.push(`/projects`);
      router.refresh();
    } catch {
      setError("Couldn't delete — try again.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const isCommercial = (editing ? jobType : report.jobType) === "commercial";

  if (editing) {
    return (
      <DailyReportForm
        report={report}
        areas={areas}
        crew={crew}
        activities={activities}
        isCommercial={isCommercial}
        state={{
          reportDate,
          setReportDate,
          jobType,
          setJobType,
          reporterName,
          setReporterName,
          generalContractor,
          setGeneralContractor,
          reviewerName,
          setReviewerName,
          body,
          setBody,
          statusValue,
          setStatusValue,
        }}
        saving={saving}
        error={error}
        onSave={save}
        onCancel={() => setEditing(false)}
      />
    );
  }

  // ---------------- READ VIEW (paper sheet, prints/shares cleanly) ---------
  const workforceTotal = totalWorkforceHours(report.body);
  const equipmentTotal = totalEquipmentHours(report.body);
  const photosByArea = groupPhotos(photos);

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 print:hidden">
        {canEdit && (
          <>
            <button
              onClick={() => setConfirmDelete(true)}
              className="mr-auto rounded-lg px-2 py-2 text-sm font-medium text-white/40 transition hover:text-red-400"
            >
              Delete
            </button>
            <button
              onClick={startEditing}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-brand hover:text-white"
            >
              Edit
            </button>
            <Link
              href={`/projects/${projectId}/plans?report=${report.id}`}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-brand hover:text-white"
            >
              Mark progress
            </Link>
          </>
        )}
        <button
          onClick={() => window.print()}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-brand hover:text-white"
        >
          Save PDF
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <article className="report-sheet mt-4 overflow-hidden rounded-2xl bg-white text-neutral-800 shadow-xl ring-1 ring-black/5 print:mt-0 print:rounded-none print:shadow-none print:ring-0">
        <header className="bg-brand px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Daily Report
            </p>
            {(company.businessName || company.phone) && (
              <div className="text-right text-xs text-white/80">
                {company.businessName && (
                  <p className="font-semibold text-white/95">
                    {company.businessName}
                  </p>
                )}
                {company.phone && <p>{company.phone}</p>}
              </div>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            {project.name}
          </h1>
          <p className="mt-2 text-sm text-white/90">
            <LocalDate iso={`${report.reportDate}T12:00:00Z`} format="long" />
            {" · "}
            <span className="capitalize">{report.jobType}</span>
            {report.status === "completed" ? " · Completed" : " · Draft"}
          </p>
          {(project.clientName || project.siteAddress) && (
            <p className="text-sm text-white/90">
              {[project.clientName, project.siteAddress]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </header>

        <div className="flex flex-col gap-6 px-6 py-6">
          {/* Header details */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Reporter" value={report.reporterName} />
            <Field label="General contractor" value={report.generalContractor} />
            <Field label="Reviewer" value={report.reviewerName} />
          </section>

          {report.weather && <WeatherCard weather={report.weather} />}

          {/* Workforce */}
          <Section title="Workforce">
            {report.body.workforce.length === 0 ? (
              <Empty>No crew logged.</Empty>
            ) : (
              <ResourceTable
                rows={report.body.workforce.map((r) => ({
                  name: r.name || "—",
                  meta: [
                    r.activity,
                    isCommercial && r.areaId ? areaName(r.areaId) : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  qty: r.quantity,
                  hours: r.hours,
                  total: rowTotalHours(r),
                }))}
                total={workforceTotal}
              />
            )}
          </Section>

          {/* Equipment */}
          {report.body.equipment.length > 0 && (
            <Section title="Equipment">
              <ResourceTable
                rows={report.body.equipment.map((r) => ({
                  name: r.name || "—",
                  meta: "",
                  qty: r.quantity,
                  hours: r.hours,
                  total: rowTotalHours(r),
                }))}
                total={equipmentTotal}
              />
            </Section>
          )}

          {/* Events */}
          <Section title="Events">
            <div className="flex flex-col gap-2">
              <EventRow label="Health & Safety" e={report.body.events.healthSafety} />
              <EventRow label="Visitors" e={report.body.events.visitors} />
              <EventRow label="Deliveries" e={report.body.events.deliveries} />
            </div>
          </Section>

          {/* Photos */}
          {photos.length > 0 && (
            <Section title="Photos">
              <div className="flex flex-col gap-4">
                {photosByArea.map((group) => (
                  <div key={group.areaId ?? "none"}>
                    {isCommercial && group.areaId && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        {areaName(group.areaId)}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.photos.map((p) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id}
                          src={p.blobUrl}
                          alt={p.caption ?? ""}
                          className="aspect-square w-full rounded-lg border border-neutral-200 object-cover"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Site progress — what got completed today, shown on the plans */}
          {progressPlans.length > 0 && (
            <Section title="Site Progress">
              <div className="flex flex-col gap-4">
                {progressPlans.map((p) => (
                  <PlanProgressSnapshot
                    key={p.id}
                    plan={{
                      name: p.name,
                      blobUrl: p.blobUrl,
                      fileType: p.fileType,
                      pageNumber: p.pageNumber,
                      renderWidth: p.renderWidth,
                    }}
                    marks={p.marks}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Observations */}
          {report.body.observations.trim() && (
            <Section title="Observations / Notes">
              <p className="whitespace-pre-wrap leading-relaxed text-neutral-700">
                {report.body.observations}
              </p>
            </Section>
          )}
        </div>

        <footer className="border-t border-neutral-200 px-6 py-4 text-center text-xs text-neutral-400">
          {project.name} · Daily report
        </footer>
      </article>

      {/* Photo management for editors, outside the printable sheet */}
      {canEdit && (
        <PhotoManager reportId={report.id} areas={areas} isCommercial={isCommercial} />
      )}

      {/* Comments — every member can post */}
      <div className="print:hidden">
        <ReportComments reportId={report.id} comments={comments} />
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy p-6 text-center">
            <h2 className="text-lg font-semibold">Delete this report?</h2>
            <p className="mt-2 text-sm text-white/60">
              This permanently removes the daily report and its photos.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-white/15 px-4 py-3 font-semibold text-white/80 disabled:opacity-50"
              >
                Keep
              </button>
              <button
                onClick={remove}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                {deleting && <Spinner />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-view helpers
// ---------------------------------------------------------------------------

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="font-medium text-neutral-800">{value?.trim() || "—"}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-brand">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

function ResourceTable({
  rows,
  total,
}: {
  rows: { name: string; meta: string; qty: number; hours: number; total: number }[];
  total: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400">
            <th className="pb-1 font-semibold">Name</th>
            <th className="pb-1 text-right font-semibold">Qty</th>
            <th className="pb-1 text-right font-semibold">Hrs</th>
            <th className="pb-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-neutral-100 text-neutral-700">
              <td className="py-1.5">
                <span className="font-medium text-neutral-800">{r.name}</span>
                {r.meta && (
                  <span className="block text-xs text-neutral-400">{r.meta}</span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{r.qty}</td>
              <td className="py-1.5 text-right tabular-nums">{r.hours}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">
                {r.total}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-200">
            <td colSpan={3} className="pt-1.5 text-right font-semibold">
              Total hours
            </td>
            <td className="pt-1.5 text-right font-bold tabular-nums">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EventRow({
  label,
  e,
}: {
  label: string;
  e: { occurred: boolean; notes: string };
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
          e.occurred
            ? "bg-brand/10 text-brand"
            : "bg-neutral-100 text-neutral-400"
        }`}
      >
        {e.occurred ? "Yes" : "No"}
      </span>
      <span className="text-neutral-700">
        <span className="font-medium text-neutral-800">{label}</span>
        {e.notes.trim() && <span> — {e.notes}</span>}
      </span>
    </div>
  );
}

function groupPhotos(photos: Photo[]) {
  const map = new Map<string | null, Photo[]>();
  for (const p of photos) {
    const key = p.areaId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([areaId, ps]) => ({
    areaId,
    photos: ps,
  }));
}

// ---------------------------------------------------------------------------
// Photo manager (editors only) — upload to Blob, attach with optional area.
// ---------------------------------------------------------------------------

function PhotoManager({
  reportId,
  areas,
  isCommercial,
}: {
  reportId: string;
  areas: Area[];
  isCommercial: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [areaId, setAreaId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: { url: string; areaId?: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const res = await upload(
          `reports/${reportId}/${Date.now()}-${i}-${f.name}`,
          f,
          { access: "public", handleUploadUrl: "/api/upload" },
        );
        uploaded.push({ url: res.url, areaId: areaId || undefined });
      }
      const res = await fetch(`/api/reports/${reportId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: uploaded }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-navy/50 p-4 print:hidden">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Add photos
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {isCommercial && areas.length > 0 && (
          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="rounded-lg border border-white/10 bg-navy px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          >
            <option value="">No area</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          disabled={uploading}
          className="text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        {uploading && <Spinner className="h-4 w-4" />}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit form — kept in a separate component so the read view stays lean.
// ---------------------------------------------------------------------------

type FormState = {
  reportDate: string;
  setReportDate: (v: string) => void;
  jobType: "commercial" | "residential";
  setJobType: (v: "commercial" | "residential") => void;
  reporterName: string;
  setReporterName: (v: string) => void;
  generalContractor: string;
  setGeneralContractor: (v: string) => void;
  reviewerName: string;
  setReviewerName: (v: string) => void;
  body: DailyReportBody;
  setBody: (v: DailyReportBody) => void;
  statusValue: "draft" | "completed";
  setStatusValue: (v: "draft" | "completed") => void;
};

function DailyReportForm({
  report,
  areas,
  crew,
  activities,
  isCommercial,
  state,
  saving,
  error,
  onSave,
  onCancel,
}: {
  report: ReportData;
  areas: Area[];
  crew: Crew[];
  activities: Activity[];
  isCommercial: boolean;
  state: FormState;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const s = state;
  const body = s.body;
  const setBody = s.setBody;

  const input =
    "w-full rounded-lg border border-white/10 bg-navy px-3 py-2 text-foreground placeholder-white/40 focus:border-brand focus:outline-none";
  const label = "text-xs font-semibold uppercase tracking-wide text-white/50";

  // ---- workforce helpers ----
  function addWorkforce() {
    const row: WorkforceRow = {
      teamMemberId: null,
      name: "",
      activity: activities[0]?.name ?? "",
      quantity: 1,
      hours: 8,
      areaId: null,
    };
    setBody({ ...body, workforce: [...body.workforce, row] });
  }
  function updateWorkforce(i: number, patch: Partial<WorkforceRow>) {
    setBody({
      ...body,
      workforce: body.workforce.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    });
  }
  function removeWorkforce(i: number) {
    setBody({ ...body, workforce: body.workforce.filter((_, j) => j !== i) });
  }

  // ---- equipment helpers ----
  function addEquipment() {
    const row: EquipmentRow = { name: "", quantity: 1, hours: 1 };
    setBody({ ...body, equipment: [...body.equipment, row] });
  }
  function updateEquipment(i: number, patch: Partial<EquipmentRow>) {
    setBody({
      ...body,
      equipment: body.equipment.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    });
  }
  function removeEquipment(i: number) {
    setBody({ ...body, equipment: body.equipment.filter((_, j) => j !== i) });
  }

  function updateEvent(
    key: keyof DailyReportBody["events"],
    patch: Partial<{ occurred: boolean; notes: string }>,
  ) {
    setBody({
      ...body,
      events: { ...body.events, [key]: { ...body.events[key], ...patch } },
    });
  }

  return (
    <div className="mt-3">
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          {(["draft", "completed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => s.setStatusValue(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                s.statusValue === st
                  ? "bg-brand/20 text-brand"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/85 disabled:opacity-50"
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {/* Header */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Report date</span>
          <input
            type="date"
            value={s.reportDate}
            onChange={(e) => s.setReportDate(e.target.value)}
            className={`mt-1 ${input}`}
          />
        </label>
        <div>
          <span className={label}>Job type</span>
          <div className="mt-1 flex gap-2">
            {(["commercial", "residential"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => s.setJobType(t)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition ${
                  s.jobType === t
                    ? "border-brand bg-brand/15 text-white"
                    : "border-white/10 text-white/60"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={label}>Reporter</span>
          <input
            value={s.reporterName}
            onChange={(e) => s.setReporterName(e.target.value)}
            className={`mt-1 ${input}`}
          />
        </label>
        <label className="block">
          <span className={label}>General contractor</span>
          <input
            value={s.generalContractor}
            onChange={(e) => s.setGeneralContractor(e.target.value)}
            placeholder="Who else is on site"
            className={`mt-1 ${input}`}
          />
        </label>
        <label className="col-span-2 block">
          <span className={label}>Reviewer</span>
          <input
            value={s.reviewerName}
            onChange={(e) => s.setReviewerName(e.target.value)}
            className={`mt-1 ${input}`}
          />
        </label>
      </div>

      {report.weather && (
        <p className="mt-4 rounded-lg border border-white/10 bg-navy/50 px-3 py-2 text-xs text-white/50">
          Weather auto-pulled ({report.weather.source}): high{" "}
          {report.weather.highF ?? "—"}° / low {report.weather.lowF ?? "—"}° ·{" "}
          {report.weather.precipInches ?? 0}&quot; precip. Not editable.
        </p>
      )}

      {/* Workforce */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className={label}>Workforce</span>
          <button
            onClick={addWorkforce}
            className="text-sm font-semibold text-brand hover:text-brand/80"
          >
            + Add crew
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-3">
          {body.workforce.map((row, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-navy/50 p-3"
            >
              <div className="flex flex-col gap-2">
                {/* Crew member — pick from list or type a name */}
                <select
                  value={row.teamMemberId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const member = crew.find((c) => c.id === id);
                    updateWorkforce(i, {
                      teamMemberId: id,
                      name: member ? member.name : row.name,
                    });
                  }}
                  className={input}
                >
                  <option value="">— Type a name below —</option>
                  {crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.trade ? ` (${c.trade})` : ""}
                    </option>
                  ))}
                </select>
                {!row.teamMemberId && (
                  <input
                    value={row.name}
                    onChange={(e) => updateWorkforce(i, { name: e.target.value })}
                    placeholder="Crew member name"
                    className={input}
                  />
                )}
                <select
                  value={row.activity}
                  onChange={(e) =>
                    updateWorkforce(i, { activity: e.target.value })
                  }
                  className={input}
                >
                  {!activities.some((a) => a.name === row.activity) &&
                    row.activity && (
                      <option value={row.activity}>{row.activity}</option>
                    )}
                  {activities.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {isCommercial && areas.length > 0 && (
                  <select
                    value={row.areaId ?? ""}
                    onChange={(e) =>
                      updateWorkforce(i, { areaId: e.target.value || null })
                    }
                    className={input}
                  >
                    <option value="">No area</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex items-end gap-2">
                  <label className="flex-1">
                    <span className="text-[11px] text-white/40">Qty</span>
                    <input
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(e) =>
                        updateWorkforce(i, { quantity: Number(e.target.value) })
                      }
                      className={input}
                    />
                  </label>
                  <label className="flex-1">
                    <span className="text-[11px] text-white/40">Hrs each</span>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={row.hours}
                      onChange={(e) =>
                        updateWorkforce(i, { hours: Number(e.target.value) })
                      }
                      className={input}
                    />
                  </label>
                  <div className="flex-1">
                    <span className="text-[11px] text-white/40">Total</span>
                    <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-semibold tabular-nums">
                      {rowTotalHours(row)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeWorkforce(i)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-white/50 hover:text-red-400"
                    aria-label="Remove crew row"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}
          {body.workforce.length > 0 && (
            <p className="text-right text-sm font-semibold">
              Total crew hours:{" "}
              <span className="tabular-nums">{totalWorkforceHours(body)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Equipment */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className={label}>Equipment (optional)</span>
          <button
            onClick={addEquipment}
            className="text-sm font-semibold text-brand hover:text-brand/80"
          >
            + Add equipment
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {body.equipment.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <input
                value={row.name}
                onChange={(e) => updateEquipment(i, { name: e.target.value })}
                placeholder="Excavator, generator…"
                className={input}
              />
              <label className="w-20">
                <span className="text-[11px] text-white/40">Qty</span>
                <input
                  type="number"
                  min={0}
                  value={row.quantity}
                  onChange={(e) =>
                    updateEquipment(i, { quantity: Number(e.target.value) })
                  }
                  className={input}
                />
              </label>
              <label className="w-20">
                <span className="text-[11px] text-white/40">Hrs</span>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={row.hours}
                  onChange={(e) =>
                    updateEquipment(i, { hours: Number(e.target.value) })
                  }
                  className={input}
                />
              </label>
              <button
                onClick={() => removeEquipment(i)}
                className="rounded-lg border border-white/10 px-3 py-2 text-white/50 hover:text-red-400"
                aria-label="Remove equipment row"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="mt-6">
        <span className={label}>Events</span>
        <div className="mt-2 flex flex-col gap-2">
          <EventEditor
            label="Health & Safety"
            e={body.events.healthSafety}
            onChange={(patch) => updateEvent("healthSafety", patch)}
            input={input}
          />
          <EventEditor
            label="Visitors"
            e={body.events.visitors}
            onChange={(patch) => updateEvent("visitors", patch)}
            input={input}
          />
          <EventEditor
            label="Deliveries"
            e={body.events.deliveries}
            onChange={(patch) => updateEvent("deliveries", patch)}
            input={input}
          />
        </div>
      </div>

      {/* Observations */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <span className={label}>Observations / Notes</span>
          <VoiceToText
            onText={(t) =>
              setBody({
                ...body,
                observations: body.observations
                  ? `${body.observations} ${t}`.trim()
                  : t,
              })
            }
          />
        </div>
        <textarea
          value={body.observations}
          onChange={(e) => setBody({ ...body, observations: e.target.value })}
          rows={5}
          placeholder="What happened on site today…"
          className={`mt-1 ${input}`}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand/85 disabled:opacity-50"
        >
          {saving && <Spinner />}
          Save report
        </button>
      </div>
    </div>
  );
}

function EventEditor({
  label,
  e,
  onChange,
  input,
}: {
  label: string;
  e: { occurred: boolean; notes: string };
  onChange: (patch: Partial<{ occurred: boolean; notes: string }>) => void;
  input: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-navy/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex gap-1">
          {[
            { v: false, l: "No" },
            { v: true, l: "Yes" },
          ].map((opt) => (
            <button
              key={opt.l}
              onClick={() => onChange({ occurred: opt.v })}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                e.occurred === opt.v
                  ? "bg-brand/20 text-brand"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>
      {e.occurred && (
        <input
          value={e.notes}
          onChange={(ev) => onChange({ notes: ev.target.value })}
          placeholder="Notes"
          className={`mt-2 ${input}`}
        />
      )}
    </div>
  );
}

// Voice-to-text using MediaRecorder → Blob upload → Whisper. Reuses the app's
// existing transcription pipeline. Audio is sent to OpenAI to transcribe.
function VoiceToText({ onText }: { onText: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => void transcribe();
      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
    } catch {
      // Mic permission denied — silently no-op; the text field still works.
    }
  }

  function stop() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setState("working");
  }

  async function transcribe() {
    try {
      const type = recorderRef.current?.mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const uploaded = await upload(
        `transcribe/${Date.now()}.${ext}`,
        blob,
        { access: "public", handleUploadUrl: "/api/upload" },
      );
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: uploaded.url }),
      });
      const data = await res.json();
      if (res.ok && data.text) onText(data.text);
    } catch {
      // ignore — user can type instead
    } finally {
      setState("idle");
    }
  }

  if (state === "working") {
    return (
      <span className="flex items-center gap-1 text-xs text-white/50">
        <Spinner className="h-3 w-3" /> Transcribing…
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={state === "recording" ? stop : start}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
        state === "recording"
          ? "bg-red-500/20 text-red-400"
          : "text-brand hover:text-brand/80"
      }`}
    >
      {state === "recording" ? "■ Stop & transcribe" : "🎤 Dictate"}
    </button>
  );
}
