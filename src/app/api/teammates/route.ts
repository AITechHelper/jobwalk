import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { teammates } from "@/lib/db/schema";
import {
  getContractorByEmail,
  requireContractor,
} from "@/lib/contractor";
import { getRoster } from "@/lib/team";

const ROLES = ["owner", "foreman", "gc", "client"] as const;
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

// POST — add a teammate to the roster by their JobWalk account email.
export async function POST(req: Request) {
  const authed = await requireContractor();
  if (!authed.ok) {
    return NextResponse.json(
      { error: authed.status === 401 ? "Unauthorized" : "Complete onboarding" },
      { status: authed.status },
    );
  }
  const owner = authed.contractor;

  const body = (await req.json().catch(() => ({}))) as {
    email?: unknown;
    role?: unknown;
  };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  const role: Role = ROLES.includes(body.role as Role)
    ? (body.role as Role)
    : "foreman";

  const member = await getContractorByEmail(email);
  if (!member) {
    return NextResponse.json(
      {
        error:
          "No JobWalk account uses that email yet. Ask them to sign up first, then add them.",
      },
      { status: 404 },
    );
  }
  if (member.id === owner.id) {
    return NextResponse.json(
      { error: "That's your own account." },
      { status: 400 },
    );
  }

  // Idempotent: onConflictDoUpdate keeps the row and refreshes the role if the
  // teammate is already on the roster, so re-adding never errors.
  const [row] = await getDb()
    .insert(teammates)
    .values({ ownerId: owner.id, memberId: member.id, role })
    .onConflictDoUpdate({
      target: [teammates.ownerId, teammates.memberId],
      set: { role },
    })
    .returning();

  return NextResponse.json({
    member: {
      id: row.id,
      memberId: member.id,
      name: member.name,
      email: member.email,
      role,
    },
  });
}
