import { randomBytes } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contractor = await getContractorByClerkId(userId);
  if (!contractor) {
    return NextResponse.json(
      { error: "Complete onboarding first" },
      { status: 400 },
    );
  }

  const { title } = await req.json();
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const [job] = await getDb()
    .insert(jobs)
    .values({
      contractorId: contractor.id,
      title: title.trim(),
      shareToken: randomBytes(16).toString("base64url"),
    })
    .returning();

  return NextResponse.json({ job });
}
