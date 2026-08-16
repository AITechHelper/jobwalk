"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LocalDate from "@/components/LocalDate";
import Spinner from "@/components/ui/Spinner";

type Comment = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

export default function ReportComments({
  reportId,
  comments,
}: {
  reportId: string;
  comments: Comment[];
}) {
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) =>
    comments.filter((c) => c.parentId === id);

  return (
    <section className="mt-8">
      <h2 className="text-xs font-bold uppercase tracking-wide text-white/50">
        Comments
      </h2>
      <p className="mt-1 text-xs text-white/40">
        Feedback from anyone on the project — GC, client, or crew.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {roots.length === 0 && (
          <p className="text-sm text-white/40">No comments yet.</p>
        )}
        {roots.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-white/10 bg-navy/50 p-3"
          >
            <CommentBody c={c} />
            <button
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              className="mt-1 text-xs font-semibold text-brand hover:text-brand/80"
            >
              {replyTo === c.id ? "Cancel" : "Reply"}
            </button>

            {repliesOf(c.id).length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-l-2 border-white/10 pl-3">
                {repliesOf(c.id).map((r) => (
                  <CommentBody key={r.id} c={r} />
                ))}
              </div>
            )}

            {replyTo === c.id && (
              <div className="mt-2 border-l-2 border-brand/30 pl-3">
                <CommentForm
                  reportId={reportId}
                  parentId={c.id}
                  onDone={() => {
                    setReplyTo(null);
                    router.refresh();
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <CommentForm reportId={reportId} onDone={() => router.refresh()} />
      </div>
    </section>
  );
}

function CommentBody({ c }: { c: Comment }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{c.authorName}</span>
        <span className="text-[11px] text-white/40">
          <LocalDate iso={c.createdAt} format="short" />
        </span>
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-white/80">{c.body}</p>
    </div>
  );
}

function CommentForm({
  reportId,
  parentId,
  onDone,
}: {
  reportId: string;
  parentId?: string;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim(), parentId }),
      });
      if (!res.ok) throw new Error();
      setText("");
      onDone();
    } catch {
      setError("Couldn't post. Try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "Write a reply…" : "Add a comment…"}
        className="w-full rounded-lg border border-white/10 bg-navy px-3 py-2 text-foreground placeholder-white/40 focus:border-brand focus:outline-none"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={post}
        disabled={posting || !text.trim()}
        className="flex items-center gap-2 self-start rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/85 disabled:opacity-50"
      >
        {posting && <Spinner className="h-3.5 w-3.5" />}
        {parentId ? "Reply" : "Comment"}
      </button>
    </div>
  );
}
