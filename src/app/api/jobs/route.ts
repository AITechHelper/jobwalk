import { randomBytes } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { getProjectAccess } from "@/lib/project-access";

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

  const { title, projectId } = (await req.json()) as {
    title?: unknown;
    projectId?: unknown;
  };
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // A walkthrough can be attached to a project. Only members who can edit that
  // project may file walkthroughs under it; otherwise it stays standalone.
  let linkedProjectId: string | null = null;
  if (typeof projectId === "string" && projectId) {
    const access = await getProjectAccess(projectId, contractor.id);
    if (!access || !access.canEdit) {
      return NextResponse.json(
        { error: "You can't add walkthroughs to that project" },
        { status: 403 },
      );
    }
    linkedProjectId = projectId;
  }

  const [job] = await getDb()
    .insert(jobs)
    .values({
      contractorId: contractor.id,
      projectId: linkedProjectId,
      title: title.trim(),
      shareToken: randomBytes(16).toString("base64url"),
    })
    .returning();

  return NextResponse.json({ job });
}
