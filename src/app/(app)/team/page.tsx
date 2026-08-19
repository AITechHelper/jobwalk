import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getContractorByClerkId } from "@/lib/contractor";
import { getRoster } from "@/lib/team";
import TeamRoster from "@/components/TeamRoster";

// My Team — the company roster (reached from the nav drawer).
export default async function TeamPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const roster = await getRoster(contractor.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <TeamRoster roster={roster} />
    </div>
  );
}
