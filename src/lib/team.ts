import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { teammates } from "./db/schema";

export type RosterEntry = {
  id: string;
  name: string;
  email: string | null;
  role: string; // "gc" | "contractor" | "client"
  linked: boolean; // true once a JobWalker account exists for this email
};

// The owner's company roster, oldest first (stable order).
export async function getRoster(ownerId: string): Promise<RosterEntry[]> {
  const rows = await getDb()
    .select({
      id: teammates.id,
      name: teammates.name,
      email: teammates.email,
      role: teammates.role,
      memberId: teammates.memberId,
    })
    .from(teammates)
    .where(eq(teammates.ownerId, ownerId))
    .orderBy(teammates.createdAt);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    linked: r.memberId != null,
  }));
}

// Does teammate `teammateId` belong to `ownerId`'s roster? Used to validate
// report assignment.
export async function teammateBelongsToOwner(
  ownerId: string,
  teammateId: string,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: teammates.id })
    .from(teammates)
    .where(and(eq(teammates.id, teammateId), eq(teammates.ownerId, ownerId)));
  return Boolean(row);
}
