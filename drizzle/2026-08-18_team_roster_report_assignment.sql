-- JobWalk — company team roster + assignable daily reports (2026-08-18)
-- Idempotent / additive. Paste the CONTENTS of this file into the Neon SQL
-- Editor (project plain-dawn-84840591, db neondb). `drizzle-kit push` hangs on
-- this environment — do not use it.

-- 1) Company roster of account-holding teammates the owner manages on Home.
--    `role` reuses the existing project_role enum (owner/foreman/gc/client).
CREATE TABLE IF NOT EXISTS teammates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'foreman',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_id)
);

-- 2) The teammate responsible for completing a daily report (their "Assigned
--    to me" queue). Null = unassigned; the report survives if that account is
--    deleted.
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS assigned_to_id uuid
  REFERENCES contractors(id) ON DELETE SET NULL;
