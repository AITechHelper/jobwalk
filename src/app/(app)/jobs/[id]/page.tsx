import { auth } from "@clerk/nextjs/server";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { jobs, photos, projectMembers, projects } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import type { Report } from "@/lib/claude";
import OwnerReport from "@/components/report/OwnerReport";
import RetryProcessingButton from "@/components/report/RetryProcessingButton";
import DeleteJobButton from "@/components/report/DeleteJobButton";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const { id } = await params;
  const db = getDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.contractorId, contractor.id)));
  if (!job) notFound();

  if (job.status === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">{job.title}</h1>
        <p className="text-sm text-white/60">
          Something went wrong generating this report. Your recording and
          photos are safe — try again.
        </p>
        <RetryProcessingButton jobId={job.id} />
        <DeleteJobButton jobId={job.id} />
      </div>
    );
  }

  if (job.status !== "ready" || !job.report) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">{job.title}</h1>
        <p className="text-sm text-white/60">
          {job.status === "processing"
            ? "Generating your report — this usually takes a minute or two. Refresh to check."
            : "This walkthrough hasn't been processed yet."}
        </p>
        <DeleteJobButton jobId={job.id} />
      </div>
    );
  }

  const jobPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.jobId, job.id))
    .orderBy(photos.offsetSeconds);
  const photoUrls = Object.fromEntries(
    jobPhotos.map((p) => [p.id, p.blobUrl]),
  );

  // Projects this contractor can move the walkthrough into (owner/foreman),
  // plus the one it's currently attached to (if any), so the report screen can
  // offer a "Project" control.
  const memberships = await db
    .select({
      id: projects.id,
      name: projects.name,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.contractorId, contractor.id))
    .orderBy(desc(projects.createdAt));
  const editableProjects = memberships
    .filter((m) => m.role === "owner" || m.role === "foreman")
    .map((m) => ({ id: m.id, name: m.name }));

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 pt-6 print:hidden">
        <Link href="/jobs" className="text-base text-white/65 hover:text-brand">
          ← All walkthroughs
        </Link>
      </div>
      <OwnerReport
        jobId={job.id}
        shareToken={job.shareToken}
        title={job.title}
        createdAt={job.createdAt}
        businessName={contractor.businessName}
        contractorName={contractor.name}
        phone={contractor.phone}
        report={job.report as Report}
        photoUrls={photoUrls}
        projectId={job.projectId}
        projects={editableProjects}
      />
    </div>
  );
}
