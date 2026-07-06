import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.unsafeMetadata?.onboardingComplete) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-navy">
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <span className="text-lg font-bold tracking-tight">
          Job<span className="text-brand-light">Walk</span>
        </span>
        <UserButton />
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-gray-800 bg-navy pb-[env(safe-area-inset-bottom)]">
        <Link
          href="/record"
          className="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium text-gray-400 hover:text-brand-light"
        >
          <span className="text-xl leading-none">●</span>
          Record
        </Link>
        <Link
          href="/jobs"
          className="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium text-gray-400 hover:text-brand-light"
        >
          <span className="text-xl leading-none">≡</span>
          Jobs
        </Link>
      </nav>
    </div>
  );
}
