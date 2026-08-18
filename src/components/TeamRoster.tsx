"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

export type RosterMember = {
  id: string;
  memberId: string;
  name: string;
  email: string;
  role: "owner" | "foreman" | "gc" | "client";
};

const ROLE_LABEL: Record<RosterMember["role"], string> = {
  owner: "Owner",
  foreman: "Foreman",
  gc: "GC",
  client: "Client",
};

// The owner's company roster: teammates who hold their own JobWalk accounts.
// Added once here, then picked when assigning daily reports. Adding by email
// requires the teammate to have signed up already.
export default function TeamRoster({ roster }: { roster: RosterMember[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RosterMember["role"]>("foreman");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputClasses =
    "w-full rounded-lg border border-white/10 bg-navy px-3 py-2.5 text-foreground placeholder-white/40 focus:border-brand focus:outline-none";

  async function add() {
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/teammates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add teammate.");
      setEmail("");
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
        Your crew&apos;s JobWalk accounts. Assign them daily reports below.
      </p>

      {roster.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {roster.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-navy px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{m.name}</p>
                <p className="truncate text-sm text-white/50">{m.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
                  {ROLE_LABEL[m.role]}
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

      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/10 bg-navy/50 p-3">
        <span className="text-sm font-semibold text-white/60">
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
            onChange={(e) => setRole(e.target.value as RosterMember["role"])}
            className="rounded-lg border border-white/10 bg-navy px-3 py-2.5 text-foreground focus:border-brand focus:outline-none"
          >
            <option value="foreman">Foreman (can edit)</option>
            <option value="owner">Owner (can edit)</option>
            <option value="gc">GC (view only)</option>
            <option value="client">Client (view only)</option>
          </select>
          <button
            onClick={add}
            disabled={adding || !email.trim()}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-base font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
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
