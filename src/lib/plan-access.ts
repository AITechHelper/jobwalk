import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { plans } from "./db/schema";
import { getProjectAccess } from "./project-access";

// Load a plan and resolve the caller's access via its project. Returns null if
// the plan doesn't exist or the caller isn't a member of its project.
export async function loadPlanForMember(planId: string, contractorId: string) {
  const [plan] = await getDb().select().from(plans).where(eq(plans.id, planId));
  if (!plan) return null;
  const access = await getProjectAccess(plan.projectId, contractorId);
  if (!access) return null;
  return { plan, access };
}
