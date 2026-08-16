"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import JobList, { type JobListItem } from "@/components/JobList";
import LocalDate from "@/components/LocalDate";
import Spinner from "@/components/ui/Spinner";
import type { ProjectAccess } from "@/lib/project-access";

type Member = {
  id: string;
  role: "owner" | "foreman" | "gc" | "client";
  contractorId: string;
  name: string;
  email: string;
};
type Area = { id: string; name: string };
type ReportRow = {
  id: string;
  reportDate: string;
  status: "draft" | "completed";
  reporterName: string | null;
};

const ROLE_LABEL: Record<Member["role"], string> = {
  owner: "Owner",
  foreman: "Foreman",
  gc: "GC",
  client: "Client",
};

export default function ProjectDetail({
  project,
  access,
  members,
  areas,
  reports,
  walkthroughs,
}: {
  project: {
    id: string;
    name: string;
    siteAddress: string | null;
    jobType: "commercial" | "residential";
    clientName: string | null;
    hasCoords: boolean;
  };
  access: ProjectAccess;
  members: Member[];
  areas: Area[];
  reports: ReportRow[];
  walkthroughs: JobListItem[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Member form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("foreman");
  const [addingMember, setAddingMember] = useState(false);

  // Area form
  const [areaName, setAreaName] = useState("");
  const [addingArea, setAddingArea] = useState(false);

  const isCommercial = project.jobType === "commercial";
  const inputClasses =
    "w-full rounded-lg border border-white/10 bg-navy px-3 py-2 text-foreground placeholder-white/40 focus:border-brand focus:outline-none";

  async function newReport() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error();
      const { report } = await res.json();
      router.push(`/reports/${report.id}`);
    } catch {
      setError("Couldn't start a report. Try again.");
      setCreating(false);
    }
  }

  async function addMember() {
    if (!email.trim()) return;
    setAddingMember(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add member.");
    } finally {
      setAddingMember(false);
    }
  }

  async function addArea() {
    if (!areaName.trim()) return;
    setAddingArea(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: areaName.trim() }),
      });
      if (!res.ok) throw new Error();
      setAreaName("");
      router.refresh();
    } catch {
      setError("Couldn't add area.");
    } finally {
      setAddingArea(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="mt-1.5 text-base text-white/65">
            <span className="capitalize">{project.jobType}</span>
            {project.clientName && <> · {project.clientName}</>}
            {project.siteAddress && <> · {project.siteAddress}</>}
          </p>
          {!project.hasCoords && project.siteAddress && (
            <p className="mt-1.5 text-sm text-amber-400/90">
              Couldn&apos;t geocode this address — weather won&apos;t auto-pull.
            </p>
          )}
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
          You: {ROLE_LABEL[access.role]}
        </span>
      </div>

      {error && <p className="mt-3 text-base text-red-400">{error}</p>}

      {/* Walkthroughs — the recordings that belong to this job. This section is
          what ties a job to its walkthroughs, which the app was missing. */}
      <section className="mt-7">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">
          Walkthroughs
        </h2>

        {access.canEdit && (
          <Link
            href={`/record?job=${project.id}`}
            className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-4 text-lg font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85"
          >
            <span aria-hidden className="text-2xl leading-none">
              🎙️
            </span>
            Record a walkthrough
          </Link>
        )}

        {walkthroughs.length === 0 ? (
          <p className="mt-3 text-base text-white/55">No walkthroughs yet.</p>
        ) : (
          <JobList jobs={walkthroughs} />
        )}
      </section>

      {/* Daily reports */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">
            Daily reports
          </h2>
          {access.canEdit && (
            <button
              onClick={newReport}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-base font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
            >
              {creating && <Spinner className="h-4 w-4" />}+ New report
            </button>
          )}
        </div>

        {reports.length === 0 ? (
          <p className="mt-3 text-base text-white/55">No reports yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-navy/50 px-4 py-3 transition hover:border-brand/50"
                >
                  <span className="font-medium">
                    <LocalDate iso={`${r.reportDate}T12:00:00Z`} format="long" />
                  </span>
                  <span className="flex items-center gap-2 text-xs text-white/50">
                    {r.reporterName}
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        r.status === "completed"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {r.status === "completed" ? "Completed" : "Draft"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Plan takeoff (Part 2) */}
      <section className="mt-8">
        <Link
          href={`/projects/${project.id}/plans`}
          className="flex items-center justify-between rounded-2xl border border-white/15 bg-navy/50 px-5 py-4 transition hover:border-brand/50"
        >
          <span className="text-lg font-semibold">
            Plan takeoff &amp; measurements
          </span>
          <span className="text-white/50">→</span>
        </Link>
      </section>

      {/* Areas — only meaningful for commercial jobs */}
      {isCommercial && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white/60">
            Rooms / areas
          </h2>
          {areas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {areas.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/70"
                >
                  {a.name}
                </span>
              ))}
            </div>
          )}
          {access.canEdit && (
            <div className="mt-2 flex gap-2">
              <input
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="e.g. Suite 200 / Lobby"
                className={inputClasses}
              />
              <button
                onClick={addArea}
                disabled={addingArea || !areaName.trim()}
                className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </section>
      )}

      {/* Team / access */}
      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">
          Team &amp; access
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg bg-navy/50 px-3 py-2 text-sm"
            >
              <span>
                {m.name}{" "}
                <span className="text-white/40">· {m.email}</span>
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/70">
                {ROLE_LABEL[m.role]}
              </span>
            </li>
          ))}
        </ul>

        {access.role === "owner" && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-navy/50 p-3">
            <span className="text-xs font-semibold text-white/50">
              Add a teammate by their JobWalk account email
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                className={inputClasses}
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Member["role"])}
                className="rounded-lg border border-white/10 bg-navy px-3 py-2 text-foreground focus:border-brand focus:outline-none"
              >
                <option value="foreman">Foreman (can edit)</option>
                <option value="owner">Owner (can edit)</option>
                <option value="gc">GC (view only)</option>
                <option value="client">Client (view only)</option>
              </select>
              <button
                onClick={addMember}
                disabled={addingMember || !email.trim()}
                className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
              >
                {addingMember ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
