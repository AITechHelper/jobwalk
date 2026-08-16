import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import { loadProjectForMember } from "@/lib/project-access";
import PlansList from "@/components/takeoff/PlansList";

export default async function PlansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const { id } = await params;
  const loaded = await loadProjectForMember(id, contractor.id);
  if (!loaded) notFound();

  const rows = await getDb()
    .select({
      id: plans.id,
      name: plans.name,
      fileType: plans.fileType,
      scaleLabel: plans.scaleLabel,
      createdAt: plans.createdAt,
    })
    .from(plans)
    .where(eq(plans.projectId, id))
    .orderBy(desc(plans.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href={`/projects/${id}`}
        className="text-sm text-white/60 hover:text-brand"
      >
        ← {loaded.project.name}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Plan takeoff</h1>
      <p className="mt-1 text-sm text-white/50">
        Upload a plan, pick a scale, then trace walls to measure them.
      </p>

      <PlansList
        projectId={id}
        canEdit={loaded.access.canEdit}
        plans={rows.map((p) => ({
          id: p.id,
          name: p.name,
          fileType: p.fileType,
          scaleLabel: p.scaleLabel,
        }))}
      />
    </div>
  );
}
