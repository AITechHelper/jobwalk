"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TRADES = [
  "Roofing",
  "HVAC",
  "Plumbing",
  "Electrical",
  "General Contractor",
  "Remodeling",
  "Concrete",
  "Landscaping",
  "Painting",
  "Solar",
  "Other",
];

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, phone, tradeType }),
      });
      if (!res.ok) throw new Error(`onboarding failed: ${res.status}`);
      // Refresh the Clerk session so the onboardingComplete flag is
      // visible to the server-side gate before we navigate.
      await user.reload();
      router.push("/record");
    } catch {
      setError("Couldn't save your info — please try again.");
      setSaving(false);
    }
  }

  const inputClasses =
    "w-full rounded-lg border border-white/10 bg-navy px-4 py-3 text-foreground placeholder-white/40 focus:border-brand focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Tell us about your business</h1>
        <p className="mt-1 mb-8 text-sm text-white/60">
          This goes on your reports, so clients know who they came from.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Business name
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Henderson Roofing LLC"
              className={inputClasses}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Phone
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(918) 555-0123"
              className={inputClasses}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Trade
            <select
              required
              value={tradeType}
              onChange={(e) => setTradeType(e.target.value)}
              className={inputClasses}
            >
              <option value="" disabled>
                Select your trade
              </option>
              {TRADES.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-2 rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Start walking jobs"}
          </button>
        </form>
      </div>
    </div>
  );
}
