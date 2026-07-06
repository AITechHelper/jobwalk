import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { contractors } from "./db/schema";

export async function getContractorByClerkId(clerkUserId: string) {
  const [contractor] = await getDb()
    .select()
    .from(contractors)
    .where(eq(contractors.clerkUserId, clerkUserId));
  return contractor ?? null;
}
