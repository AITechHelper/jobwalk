"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

// WORDING: the user-facing term for a job site is "Project" (Clients →
// Projects → Rooms/Areas), matching the `projects` table. Walkthroughs (the
// `jobs` table) are the recordings that live inside a project.

type ProjectRow = {
  id: string;
  name: string;
  siteAddress: string | null;
  jobType: "commercial" | "residential";
  role: "owner" | "foreman" | "gc" | "client";
  clientName: string | null;
};

const ROLE_LABEL: Record<ProjectRow["role"], string> = {
  owner: "Owner",
  foreman: "Foreman",
  gc: "GC",
  client: "Client",
};

export default function ProjectsHub({
  projects,
  clients,
}: {
  projects: ProjectRow[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);

  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [jobType, setJobType] = useState<"commercial" | "residential">(
    "commercial",
  );
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createClient() {
    if (!clientName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName.trim() }),
      });
      if (!res.ok) throw new Error();
      setClientName("");
      setShowNewClient(false);
      router.refresh();
    } catch {
      setError("Couldn't add client. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function createProject() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          siteAddress: siteAddress.trim() || undefined,
          jobType,
          clientId: clientId || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const { project } = await res.json();
      router.push(`/projects/${project.id}`);
    } catch {
      setError("Couldn't create project. Try again.");
      setSaving(false);
    }
  }

  const inputClasses =
    "w-full rounded-xl border border-white/15 bg-navy px-4 py-3 text-lg text-foreground placeholder-white/40 focus:border-brand focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Projects</h2>
        <button
          onClick={() => {
            setShowNew((v) => !v);
            setError(null);
          }}
          className="rounded-xl bg-brand px-5 py-3 text-lg font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85"
        >
          {showNew ? "Close" : "+ New project"}
        </button>
      </div>

      {showNew && (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-white/15 bg-navy/50 p-4">
          <label className="block">
            <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Project name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Office Buildout"
              className={`mt-1.5 ${inputClasses}`}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Site address
            </span>
            <input
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="123 Main St, Tulsa, OK 74103"
              className={`mt-1.5 ${inputClasses}`}
            />
            <span className="mt-1.5 block text-sm text-white/50">
              Used to auto-pull weather for every daily report.
            </span>
          </label>

          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Job type
            </span>
            <div className="mt-1.5 flex gap-2">
              {(["commercial", "residential"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setJobType(t)}
                  className={`flex-1 rounded-xl border px-3 py-3 text-base font-semibold capitalize transition ${
                    jobType === t
                      ? "border-brand bg-brand/15 text-white"
                      : "border-white/15 text-white/70 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Client (optional)
            </span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={`mt-1.5 ${inputClasses}`}
            >
              <option value="">— No client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewClient((v) => !v)}
              className="mt-2 text-base font-semibold text-brand hover:text-brand/80"
            >
              {showNewClient ? "Cancel" : "+ Add a new client"}
            </button>
          </label>

          {showNewClient && (
            <div className="flex gap-2">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
                className={inputClasses}
              />
              <button
                type="button"
                onClick={createClient}
                disabled={saving || !clientName.trim()}
                className="shrink-0 rounded-xl border border-white/20 px-4 py-3 text-base font-semibold text-white/85 transition hover:text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}

          {error && <p className="text-base text-red-400">{error}</p>}

          <button
            onClick={createProject}
            disabled={saving || !name.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-4 text-lg font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85 disabled:opacity-50"
          >
            {saving && <Spinner className="h-5 w-5" />}
            Create project
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-xl text-white/80">No projects yet.</p>
          <p className="mt-2 text-base text-white/55">
            Create a project to start recording walkthroughs and daily reports.
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block rounded-2xl border border-white/15 bg-navy p-5 transition active:scale-[0.99] hover:border-brand/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xl font-bold">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/80">
                    {ROLE_LABEL[p.role]}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-base text-white/65">
                  <span className="capitalize">{p.jobType}</span>
                  {p.clientName && <span>· {p.clientName}</span>}
                  {p.siteAddress && <span>· {p.siteAddress}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/jobs"
        className="mt-8 flex items-center justify-center gap-2 text-base font-semibold text-white/60 hover:text-white"
      >
        View all walkthroughs →
      </Link>
    </div>
  );
}
