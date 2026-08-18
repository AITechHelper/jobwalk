import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { teammates } from "@/lib/db/schema";
import {
  getContractorByEmail,
  requireContractor,
} from "@/lib/contractor";
import { getRoster } from "@/lib/team";

const ROLES = ["gc", "contractor", "client"] as const;
type Role = (typeof ROLES)[number];

// GET — the owner's company roster.
export async function GET() {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }
  const roster = await getRoster(authed.contractor.id);
  return NextResponse.json({ roster });
}

// POST — add a teammate by typed name + email + role. No account required; if a
// JobWalk account already exists for that email, link it now (otherwise it gets
// linked when they sign up — see the onboarding route).
export async function POST(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    email?: unknown;
    role?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role: Role = ROLES.includes(body.role as Role)
    ? (body.role as Role)
    : "contractor";

  // Link to an existing account if this email already has one.
  const existing = email ? await getContractorByEmail(email) : null;

  const [row] = await getDb()
    .insert(teammates)
    .values({
      ownerId: authed.contractor.id,
      name,
      email: email || null,
      role,
      memberId: existing?.id ?? null,
    })
    .returning();

  return NextResponse.json({
    member: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      linked: row.memberId != null,
    },
  });
}
