import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { contractors, teammates } from "./db/schema";

export type RosterEntry = {
  id: string; // teammates row id
  memberId: string; // the teammate's contractor account id
  name: string;
  email: string;
  role: "owner" | "foreman" | "gc" | "client";
};

// The owner's company roster: every teammate they've added, with the
// teammate's account details. Newest first.
export async function getRoster(ownerId: string): Promise<RosterEntry[]> {
  const rows = await getDb()
    .select({
      id: teammates.id,
      memberId: teammates.memberId,
      name: contractors.name,
      email: contractors.email,
      role: teammates.role,
    })
    .from(teammates)
    .innerJoin(contractors, eq(teammates.memberId, contractors.id))
    .where(eq(teammates.ownerId, ownerId))
    .orderBy(teammates.createdAt);
  return rows;
}

// Can `candidateId` be assigned work by `ownerId`? True for the owner
// themselves or anyone on their roster. Used to validate report assignment.
export async function isAssignable(
  ownerId: string,
  candidateId: string,
): Promise<boolean> {
  if (candidateId === ownerId) return true;
  const [row] = await getDb()
    .select({ id: teammates.id })
    .from(teammates)
    .where(
      and(eq(teammates.ownerId, ownerId), eq(teammates.memberId, candidateId)),
    );
  return Boolean(row);
}
