"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LocalDate from "@/components/LocalDate";
import Spinner from "@/components/ui/Spinner";

type AssignedReport = {
  id: string;
  reportDate: string;
  status: "draft" | "completed";
  projectName: string;
};
type EditableProject = { id: string; name: string };
type Assignee = { id: string; name: string };

// Home-hub reports: the caller's "Assigned to me" queue, plus a create-and-
// assign form so an owner can spin up a daily report for a project and hand it
// to a teammate to complete.
export default function ReportsPanel({
  assignedToMe,
  editableProjects,
  assignees,
  myId,
}: {
  assignedToMe: AssignedReport[];
  editableProjects: EditableProject[];
  assignees: Assignee[];
  myId: string;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [projectId, setProjectId] = useState(editableProjects[0]?.id ?? "");
  const [reportDate, setReportDate] = useState(today);
  const [assignedToId, setAssignedToId] = useState(myId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!projectId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate,
          assignedToId: assignedToId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create report.");
      router.push(`/reports/${data.report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create report.");
      setCreating(false);
    }
  }

  const controlClasses =
    "w-full rounded-lg border border-white/10 bg-navy px-3 py-2.5 text-foreground focus:border-brand focus:outline-none";

  return (
    <section className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-2xl font-bold">Reports</h2>

      {/* Assigned to me */}
      {assignedToMe.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">
            Assigned to me
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {assignedToMe.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-navy px-4 py-3 transition active:scale-[0.99] hover:border-brand/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.projectName}</p>
                    <p className="text-sm text-white/50">
                      <LocalDate
                        iso={`${r.reportDate}T12:00:00Z`}
                        format="long"
                      />
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      r.status === "completed"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {r.status === "completed" ? "Completed" : "Draft"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create & assign */}
      <div className="mt-4 rounded-xl border border-white/10 bg-navy/50 p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-white/60">
          New report
        </h3>
        {editableProjects.length === 0 ? (
          <p className="mt-2 text-base text-white/55">
            Create a project first, then you can start a report for it.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <label className="block">
              <span className="text-sm text-white/60">Project</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={`mt-1 ${controlClasses}`}
              >
                {editableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="block flex-1">
                <span className="text-sm text-white/60">Date</span>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className={`mt-1 ${controlClasses}`}
                />
              </label>
              <label className="block flex-1">
                <span className="text-sm text-white/60">Assign to</span>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className={`mt-1 ${controlClasses}`}
                >
                  <option value={myId}>Me</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  <option value="">Unassigned</option>
                </select>
              </label>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={create}
              disabled={creating || !projectId}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-lg font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85 disabled:opacity-50"
            >
              {creating && <Spinner className="h-5 w-5" />}
              Create report
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
