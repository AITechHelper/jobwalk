import { asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { activityTypes } from "./db/schema";
import { DEFAULT_ACTIVITY_TYPES } from "./dailyReport";

// Return a contractor's activity-type list, seeding the defaults the first time
// so the workforce dropdown is never empty. The customizable list grows as the
// contractor adds their own trades.
export async function getOrSeedActivityTypes(
  contractorId: string,
): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  const existing = await db
    .select({ id: activityTypes.id, name: activityTypes.name })
    .from(activityTypes)
    .where(eq(activityTypes.contractorId, contractorId))
    .orderBy(asc(activityTypes.name));
  if (existing.length > 0) return existing;

  await db
    .insert(activityTypes)
    .values(
      DEFAULT_ACTIVITY_TYPES.map((name) => ({ contractorId, name })),
    )
    .onConflictDoNothing();

  return db
    .select({ id: activityTypes.id, name: activityTypes.name })
    .from(activityTypes)
    .where(eq(activityTypes.contractorId, contractorId))
    .orderBy(asc(activityTypes.name));
}
