import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessName, phone, tradeType } = await req.json();
  if (
    typeof businessName !== "string" ||
    !businessName.trim() ||
    typeof phone !== "string" ||
    !phone.trim() ||
    typeof tradeType !== "string" ||
    !tradeType.trim()
  ) {
    return NextResponse.json(
      { error: "businessName, phone, and tradeType are required" },
      { status: 400 },
    );
  }

  const user = await currentUser();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Unknown";
  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  const values = {
    name,
    email,
    phone: phone.trim(),
    businessName: businessName.trim(),
    tradeType: tradeType.trim(),
  };

  await getDb()
    .insert(contractors)
    .values({ clerkUserId: userId, ...values })
    .onConflictDoUpdate({
      target: contractors.clerkUserId,
      set: { ...values, updatedAt: new Date() },
    });

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { onboardingComplete: true },
  });

  return NextResponse.json({ ok: true });
}
