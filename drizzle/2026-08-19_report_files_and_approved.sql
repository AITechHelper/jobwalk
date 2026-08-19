-- JobWalker — report file attachments + "Date Approved" header field
-- (2026-08-19). Idempotent/additive. Paste CONTENTS into the Neon SQL Editor
-- (project plain-dawn-84840591, db neondb). drizzle-kit push hangs here.

-- STACK "Date Approved" on the daily report.
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS date_approved date;

-- STACK "Linked Documents & Files": non-photo attachments on a report.
CREATE TABLE IF NOT EXISTS report_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  name text NOT NULL,
  blob_url text NOT NULL,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- (Workforce per-row "notes" and photo "caption" need no migration — notes live
--  in the daily_reports.body JSONB, and report_photos.caption already exists.)
