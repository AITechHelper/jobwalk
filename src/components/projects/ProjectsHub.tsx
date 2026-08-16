"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

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
    "w-full rounded-lg border border-white/10 bg-navy px-3 py-2.5 text-foreground placeholder-white/40 focus:border-brand focus:outline-none";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => {
            setShowNew((v) => !v);
            setError(null);
          }}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/85"
        >
          {showNew ? "Close" : "+ New project"}
        </button>
      </div>

      {showNew && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-navy/50 p-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Project name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Office Buildout"
              className={`mt-1 ${inputClasses}`}
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Site address
            </span>
            <input
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="123 Main St, Tulsa, OK 74103"
              className={`mt-1 ${inputClasses}`}
            />
            <span className="mt-1 block text-xs text-white/40">
              Used to auto-pull weather for every daily report.
            </span>
          </label>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Job type
            </span>
            <div className="mt-1 flex gap-2">
              {(["commercial", "residential"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setJobType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition ${
                    jobType === t
                      ? "border-brand bg-brand/15 text-white"
                      : "border-white/10 text-white/60 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Client (optional)
            </span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={`mt-1 ${inputClasses}`}
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
              className="mt-1 text-xs font-semibold text-brand hover:text-brand/80"
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
                className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={createProject}
            disabled={saving || !name.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
          >
            {saving && <Spinner className="h-4 w-4" />}
            Create project
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="mt-16 text-center text-white/60">
          <p>No projects yet.</p>
          <p className="mt-1 text-sm text-white/40">
            Create a project to start logging daily reports.
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block rounded-xl border border-white/10 bg-navy/50 p-4 transition hover:border-brand/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">
                    {ROLE_LABEL[p.role]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-white/50">
                  <span className="capitalize">{p.jobType}</span>
                  {p.clientName && <span>· {p.clientName}</span>}
                  {p.siteAddress && <span>· {p.siteAddress}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
