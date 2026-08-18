import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { contractors, teammates } from "@/lib/db/schema";

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

  const [contractor] = await getDb()
    .insert(contractors)
    .values({ clerkUserId: userId, ...values })
    .onConflictDoUpdate({
      target: contractors.clerkUserId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning({ id: contractors.id });

  // Auto-link: any roster entries that were added with this email (before this
  // person had an account) now point at their contractor account.
  if (contractor && email) {
    await getDb()
      .update(teammates)
      .set({ memberId: contractor.id })
      .where(
        and(
          isNull(teammates.memberId),
          sql`lower(${teammates.email}) = ${email.trim().toLowerCase()}`,
        ),
      );
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { onboardingComplete: true },
  });

  return NextResponse.json({ ok: true });
}
