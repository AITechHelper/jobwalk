"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

type EditableProject = { id: string; name: string };
type Assignee = { id: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  gc: "GC",
  contractor: "Contractor",
  client: "Client",
};

// Home-hub reports: create a daily report for a project and assign it to a
// roster teammate (who's responsible). The assignee is stamped on the report.
export default function ReportsPanel({
  editableProjects,
  assignees,
}: {
  editableProjects: EditableProject[];
  assignees: Assignee[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [projectId, setProjectId] = useState(editableProjects[0]?.id ?? "");
  const [reportDate, setReportDate] = useState(today);
  const [assignedTeammateId, setAssignedTeammateId] = useState("");
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
          assignedTeammateId: assignedTeammateId || undefined,
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
    "w-full rounded-lg border border-white/20 bg-navy px-3 py-2.5 text-foreground focus:border-brand focus:outline-none";

  return (
    <section>
      <h2 className="text-2xl font-bold">Reports</h2>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
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
                  value={assignedTeammateId}
                  onChange={(e) => setAssignedTeammateId(e.target.value)}
                  className={`mt-1 ${controlClasses}`}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {ROLE_LABEL[a.role] ? ` (${ROLE_LABEL[a.role]})` : ""}
                    </option>
                  ))}
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
