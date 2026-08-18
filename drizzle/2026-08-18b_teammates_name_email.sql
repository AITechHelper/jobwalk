-- JobWalk — teammates become typed name + email + text role, and report
-- assignment references the roster teammate (2026-08-18b). Idempotent/additive.
-- Paste CONTENTS into the Neon SQL Editor (project plain-dawn-84840591, db
-- neondb). Supersedes the account-only teammates shape from the earlier
-- 2026-08-18 migration.

-- teammates: typed name + email; role as free text (gc/contractor/client);
-- member_id becomes an optional account link instead of required.
ALTER TABLE teammates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE teammates ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE teammates ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE teammates DROP CONSTRAINT IF EXISTS teammates_owner_id_member_id_key;
ALTER TABLE teammates ALTER COLUMN role DROP DEFAULT;
ALTER TABLE teammates ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE teammates ALTER COLUMN role SET DEFAULT 'contractor';
-- Any pre-existing account-only rows have no typed name yet; give them one so
-- the NOT NULL below holds. (Expected to affect 0 rows.)
UPDATE teammates SET name = 'Teammate' WHERE name IS NULL;
ALTER TABLE teammates ALTER COLUMN name SET NOT NULL;

-- daily_reports: assignment points at the roster teammate, not a contractor.
ALTER TABLE daily_reports DROP COLUMN IF EXISTS assigned_to_id;
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS assigned_teammate_id uuid
  REFERENCES teammates(id) ON DELETE SET NULL;
