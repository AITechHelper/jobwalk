"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

export type RosterMember = {
  id: string;
  name: string;
  email: string | null;
  role: string; // "gc" | "contractor" | "client"
  linked: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  gc: "GC",
  contractor: "Contractor",
  client: "Client",
};

// The owner's company roster. Add teammates by typing their name, email, and
// role — no account needed. If they later sign up with that email, the entry
// links to their account automatically (see the onboarding route).
export default function TeamRoster({ roster }: { roster: RosterMember[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("contractor");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputClasses =
    "w-full rounded-lg border border-white/20 bg-navy px-3 py-2.5 text-foreground placeholder-white/40 focus:border-brand focus:outline-none";

  async function add() {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/teammates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add teammate.");
      setName("");
      setEmail("");
      setRole("contractor");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add teammate.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/teammates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Couldn't remove teammate.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-bold">Team</h2>
      <p className="mt-1 text-sm text-white/55">
        Your crew. Add anyone by name — assign them daily reports below.
      </p>

      {roster.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {roster.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.name}</p>
                {m.email && (
                  <p className="truncate text-sm text-white/50">{m.email}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                <button
                  onClick={() => remove(m.id)}
                  disabled={removingId === m.id}
                  aria-label={`Remove ${m.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  {removingId === m.id ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <span aria-hidden className="text-lg leading-none">
                      ×
                    </span>
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <span className="text-sm font-semibold text-white/60">
          Add a teammate
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className={inputClasses}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          className={inputClasses}
        />
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="flex-1 rounded-lg border border-white/20 bg-navy px-3 py-2.5 text-foreground focus:border-brand focus:outline-none"
          >
            <option value="gc">GC</option>
            <option value="contractor">Contractor</option>
            <option value="client">Client</option>
          </select>
          <button
            onClick={add}
            disabled={adding || !name.trim()}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-base font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
          >
            {adding && <Spinner className="h-4 w-4" />}
            Add
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}
