import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getContractorByClerkId } from "@/lib/contractor";
import JobList from "@/components/JobList";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const contractor = await getContractorByClerkId(userId);
  if (!contractor) redirect("/onboarding");

  const { q } = await searchParams;
  const search = q?.trim();

  const rows = await getDb()
    .select()
    .from(jobs)
    .where(
      search
        ? and(
            eq(jobs.contractorId, contractor.id),
            ilike(jobs.title, `%${search}%`),
          )
        : eq(jobs.contractorId, contractor.id),
    )
    .orderBy(desc(jobs.createdAt));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Your jobs</h1>

      <form className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Search jobs..."
          className="w-full rounded-lg border border-white/10 bg-navy px-4 py-3 text-foreground placeholder-white/40 focus:border-brand focus:outline-none"
        />
      </form>

      {rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="text-white/60">
            {search
              ? `No jobs matching "${search}".`
              : "No walkthroughs yet."}
          </p>
          {!search && (
            <Link
              href="/record"
              className="rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand/85"
            >
              Record your first walkthrough
            </Link>
          )}
        </div>
      ) : (
        <JobList
          jobs={rows.map((job) => ({
            id: job.id,
            title: job.title,
            status: job.status,
            createdAt: job.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
