import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getContractorByClerkId } from "@/lib/contractor";
import AccountScreen from "@/components/AccountScreen";

export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  return (
    <AccountScreen
      name={contractor.name}
      businessName={contractor.businessName}
      email={contractor.email}
    />
  );
}
