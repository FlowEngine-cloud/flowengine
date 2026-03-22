-- GoTrue compatibility fixes for supabase/postgres:15.8.1.060 + GoTrue v2.170.0
--
-- The postgres image puts auth enum types in the public schema.
-- GoTrue migration 20221003041349 creates them in a single DO $$ block —
-- when it hits duplicate_object for factor_type it exits early, leaving
-- factor_status and aal_level uncreated.
-- Fix: pre-create all three types in the auth schema so GoTrue's
-- CREATE TABLE IF NOT EXISTS statements find them and succeed.
--
-- Backfill migrations (20221125140132, 20221208132122, 20230131181311) fail
-- on fresh installs due to type/operator mismatches on empty tables.
-- Fix: mark them as already applied — they are safe to skip on new installs.

-- 1. Ensure schema_migrations table exists
CREATE TABLE IF NOT EXISTS auth.schema_migrations (version text NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_version_idx ON auth.schema_migrations (version);

-- 2. Pre-create enum types in the auth schema
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'auth' AND t.typname = 'factor_type') THEN
    CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'auth' AND t.typname = 'factor_status') THEN
    CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'auth' AND t.typname = 'aal_level') THEN
    CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
  END IF;
END $$;

-- 3. Skip backfill migrations that fail on fresh installs
INSERT INTO auth.schema_migrations (version) VALUES
  ('20221125140132'),
  ('20221208132122'),
  ('20230131181311')
ON CONFLICT DO NOTHING;
