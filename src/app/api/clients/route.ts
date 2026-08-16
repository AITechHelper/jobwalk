import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { requireContractor } from "@/lib/contractor";

export async function POST(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const body = (await req.json()) as {
    name?: unknown;
    contactName?: unknown;
    contactEmail?: unknown;
    contactPhone?: unknown;
  };
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const [client] = await getDb()
    .insert(clients)
    .values({
      contractorId: authed.contractor.id,
      name: body.name.trim(),
      contactName: str(body.contactName),
      contactEmail: str(body.contactEmail),
      contactPhone: str(body.contactPhone),
    })
    .returning();

  return NextResponse.json({ client });
}
