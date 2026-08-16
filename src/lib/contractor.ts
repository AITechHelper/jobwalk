import { auth } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { contractors } from "./db/schema";

export async function getContractorByClerkId(clerkUserId: string) {
  const [contractor] = await getDb()
    .select()
    .from(contractors)
    .where(eq(contractors.clerkUserId, clerkUserId));
  return contractor ?? null;
}

export async function getContractorByEmail(email: string) {
  const [contractor] = await getDb()
    .select()
    .from(contractors)
    .where(sql`lower(${contractors.email}) = ${email.trim().toLowerCase()}`);
  return contractor ?? null;
}

export type Contractor = NonNullable<
  Awaited<ReturnType<typeof getContractorByClerkId>>
>;

// Resolve the signed-in Clerk user to their contractor row. Returns a discreet
// union so route handlers can early-return the right status code.
export async function requireContractor(): Promise<
  | { ok: true; contractor: Contractor }
  | { ok: false; status: 401 | 400 }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401 };
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) return { ok: false, status: 400 };
  return { ok: true, contractor };
}
