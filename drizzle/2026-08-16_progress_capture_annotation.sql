-- JobWalk migration: progress marking, multi-contributor capture, photo
-- annotation, and per-project default GC. Idempotent + additive only — safe to
-- run more than once. Paste into the Neon SQL Editor (drizzle-kit push hangs
-- from the dev environment; the app connects via neon-http, not websockets).

-- 1) Part 1 — default general contractor per project. New daily reports
--    pre-fill their (still editable) GC from this.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS general_contractor text;

-- 2) Part 5 — link a walkthrough (capture session) to the daily report it
--    feeds. Multiple sessions can point at the same report; null = standalone.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS daily_report_id uuid REFERENCES daily_reports(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jobs_daily_report_id_idx ON jobs (daily_report_id);

-- 3) Part 5 — per-contributor attribution for merged reports.
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS contributions jsonb;

-- 4) Part 6 — annotated photo copy + reopenable vector strokes. The original
--    blob_url is never overwritten; annotations land in a separate blob.
ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS annotated_blob_url text;
ALTER TABLE report_photos ADD COLUMN IF NOT EXISTS annotation jsonb;

-- 5) Part 4 — plan progress marks. A mark tags a traced measurement OR carries
--    its own freeform points, and optionally logs against a daily report.
CREATE TABLE IF NOT EXISTS plan_progress_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  measurement_id uuid REFERENCES measurements(id) ON DELETE CASCADE,
  report_id uuid REFERENCES daily_reports(id) ON DELETE SET NULL,
  created_by_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  status_label text NOT NULL,
  color text,
  points jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_progress_marks_plan_id_idx ON plan_progress_marks (plan_id);
CREATE INDEX IF NOT EXISTS plan_progress_marks_report_id_idx ON plan_progress_marks (report_id);
