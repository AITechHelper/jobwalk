import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getContractorByClerkId } from "@/lib/contractor";
import OrgEditor from "@/components/OrgEditor";

// My Org — edit business/account details (reached from the nav drawer, or by
// tapping the business card on Home).
export default async function OrgPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  return (
    <OrgEditor
      initial={{
        name: contractor.name,
        businessName: contractor.businessName,
        phone: contractor.phone,
        tradeType: contractor.tradeType,
        email: contractor.email,
      }}
    />
  );
}
