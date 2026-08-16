import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clients, projectMembers, projects } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";
import { geocodeAddress } from "@/lib/weather";

// Geocoding can take a few seconds against the Census/Nominatim services.
export const maxDuration = 30;

export async function POST(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }
  const contractor = authed.contractor;

  const body = (await req.json()) as {
    name?: unknown;
    siteAddress?: unknown;
    jobType?: unknown;
    clientId?: unknown;
  };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const jobType =
    body.jobType === "residential" ? "residential" : "commercial";
  const siteAddress =
    typeof body.siteAddress === "string" && body.siteAddress.trim()
      ? body.siteAddress.trim()
      : null;

  const db = getDb();

  // Verify the client (if given) belongs to this contractor before linking.
  let clientId: string | null = null;
  if (typeof body.clientId === "string" && body.clientId) {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(eq(clients.id, body.clientId), eq(clients.contractorId, contractor.id)),
      );
    if (!client) {
      return NextResponse.json({ error: "Unknown client" }, { status: 400 });
    }
    clientId = client.id;
  }

  // Geocode once at creation; every daily report reuses these coordinates for
  // automated weather. A geocode miss is non-fatal — weather just won't pull.
  const geo = siteAddress ? await geocodeAddress(siteAddress) : null;

  const [project] = await db
    .insert(projects)
    .values({
      contractorId: contractor.id,
      clientId,
      name: body.name.trim(),
      siteAddress,
      jobType,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
    })
    .returning();

  // The creator is the owner and can edit reports.
  await db.insert(projectMembers).values({
    projectId: project.id,
    contractorId: contractor.id,
    role: "owner",
  });

  return NextResponse.json({ project, geocoded: Boolean(geo) });
}
