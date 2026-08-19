import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import NavDrawer from "@/components/NavDrawer";
import { getContractorByClerkId } from "@/lib/contractor";

// Two-letter initials for the account chip in the menu. Falls back to the
// first letter of the business name, then a person glyph, so it's never blank.
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
      <header className="grid grid-cols-3 items-center gap-3 border-b border-white/30 bg-navy px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] print:hidden">
        {/* Figure logo, left */}
        <Link
          href="/dashboard"
          className="justify-self-start"
          aria-label="JobWalker home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/jobwalker-mark.png" alt="" className="h-16 w-auto" />
        </Link>

        {/* JobWalker wordmark, dead center */}
        <Link
          href="/dashboard"
          className="justify-self-center text-2xl font-bold tracking-tight"
        >
          Job<span className="text-brand">Walker</span>
        </Link>

        {/* Menu, right */}
        <NavDrawer
          businessName={contractor?.businessName ?? null}
          email={contractor?.email ?? null}
          initials={initials}
        />
      </header>

      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        {children}
      </main>
    </div>
  );
}
