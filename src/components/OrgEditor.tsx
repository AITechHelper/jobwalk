"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Spinner from "@/components/ui/Spinner";

// My Org — edit the business/account details shown across the app. Email is
// managed by the sign-in provider and is read-only here.
export default function OrgEditor({
  initial,
}: {
  initial: {
    name: string;
    businessName: string;
    phone: string;
    tradeType: string;
    email: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [phone, setPhone] = useState(initial.phone);
  const [tradeType, setTradeType] = useState(initial.tradeType);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== initial.name ||
    businessName !== initial.businessName ||
    phone !== initial.phone ||
    tradeType !== initial.tradeType;

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessName, phone, tradeType }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClasses =
    "mt-1.5 w-full rounded-xl border border-white/20 bg-navy px-4 py-3 text-lg text-foreground placeholder-white/40 focus:border-brand focus:outline-none";
  const labelClasses =
    "text-sm font-semibold uppercase tracking-wide text-white/60";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-3xl font-bold">My Org</h1>
      <p className="mt-1 text-base text-white/55">
        These details appear on your dashboard and reports.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <label className="block">
          <span className={labelClasses}>Business name</span>
          <input
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value);
              setSaved(false);
            }}
            className={inputClasses}
          />
        </label>

        <label className="block">
          <span className={labelClasses}>Trade</span>
          <input
            value={tradeType}
            onChange={(e) => {
              setTradeType(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Roofing"
            className={inputClasses}
          />
        </label>

        <label className="block">
          <span className={labelClasses}>Contact name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className={inputClasses}
          />
        </label>

        <label className="block">
          <span className={labelClasses}>Phone</span>
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setSaved(false);
            }}
            className={inputClasses}
          />
        </label>

        <label className="block">
          <span className={labelClasses}>Email</span>
          <input
            value={initial.email}
            disabled
            className={`${inputClasses} opacity-60`}
          />
          <span className="mt-1 block text-sm text-white/40">
            Managed by your sign-in — not editable here.
          </span>
        </label>

        {error && <p className="text-base text-red-400">{error}</p>}

        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-4 text-lg font-semibold text-white transition active:scale-[0.99] hover:bg-brand/85 disabled:opacity-50"
        >
          {saving && <Spinner className="h-5 w-5" />}
          {saved && !dirty ? "Saved ✓" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
