import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getContractorByClerkId } from "@/lib/contractor";

// Two-letter initials for the account chip in the header. Falls back to the
// first letter of the business name, then a person glyph, so the chip is never
// blank.
function initialsFrom(name: string | null, business: string | null): string {
  const source = (name ?? business ?? "").trim();
  if (!source) return "•";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.publicMetadata?.onboardingComplete) redirect("/onboarding");

  const contractor = await getContractorByClerkId(user.id);
  const initials = initialsFrom(
    contractor?.name ?? null,
    contractor?.businessName ?? null,
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-navy px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] print:hidden">
        {/* Logo, top-left */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-base font-black text-white"
          >
            J
          </span>
          <span className="text-xl font-bold tracking-tight">
            Job<span className="text-brand">Walk</span>
          </span>
        </Link>

        {/* Account, top-right */}
        <Link
          href="/account"
          aria-label="Account"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm font-bold text-white transition active:scale-95 hover:border-brand/60"
        >
          {initials}
        </Link>
      </header>

      <main className="flex-1 pb-28">{children}</main>

      <BottomNav />
    </div>
  );
}
