import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { getProjectAccess } from "@/lib/project-access";

// Register a plan uploaded to Blob storage against a project. Editors only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const { id } = await params;
  const access = await getProjectAccess(id, authed.contractor.id);
  if (!access) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!access.canEdit) {
    return NextResponse.json({ error: "View-only access" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: unknown;
    blobUrl?: unknown;
    fileType?: unknown;
  };
  if (typeof body.blobUrl !== "string" || !body.blobUrl) {
    return NextResponse.json({ error: "blobUrl required" }, { status: 400 });
  }
  const fileType = body.fileType === "image" ? "image" : "pdf";
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Untitled plan";

  const [plan] = await getDb()
    .insert(plans)
    .values({
      projectId: id,
      createdById: authed.contractor.id,
      name,
      blobUrl: body.blobUrl,
      fileType,
    })
    .returning();

  return NextResponse.json({ plan });
}
