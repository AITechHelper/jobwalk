import { currentUser } from "@clerk/nextjs/server";
import WalkthroughRecorder from "@/components/recorder/WalkthroughRecorder";

export default async function RecordPage() {
  // Consent lives on the user, so a fresh account always sees the disclosure
  // even on a device where someone else already agreed.
  const user = await currentUser();
  const consented = Boolean(user?.publicMetadata?.aiConsentAt);

  return <WalkthroughRecorder initialConsent={consented} />;
}
