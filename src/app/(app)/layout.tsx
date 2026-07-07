import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.publicMetadata?.onboardingComplete) redirect("/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-white/10 bg-navy px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <span className="text-lg font-bold tracking-tight">
          Job<span className="text-brand">Walk</span>
        </span>
        <UserButton />
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <BottomNav />
    </div>
  );
}
