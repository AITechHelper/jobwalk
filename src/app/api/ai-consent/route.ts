import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Records that this user agreed to have their walkthrough audio and photos
// sent to OpenAI and Anthropic. Stored on the Clerk user so consent follows the
// account across devices — a device-local flag would let one person's consent
// silently apply to a different account signing in on the same device.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const client = await clerkClient();

  // Spread the existing metadata so this doesn't clobber onboardingComplete.
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...user?.publicMetadata,
      aiConsentAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true });
}
