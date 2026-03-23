-- Storage schema initialization (runs after supabase-schema.sql)
-- Creates the storage.buckets table and the agency-branding bucket.
-- Idempotent — safe to run multiple times.

CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text        NOT NULL PRIMARY KEY,
  name               text        NOT NULL,
  owner              uuid,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  public             boolean     DEFAULT false,
  avif_autodetection boolean     DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  owner_id           text
);

CREATE UNIQUE INDEX IF NOT EXISTS bname ON storage.buckets USING btree (name);

CREATE TABLE IF NOT EXISTS storage.objects (
  id               uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  bucket_id        text        REFERENCES storage.buckets ON DELETE CASCADE,
  name             text,
  owner            uuid,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  metadata         jsonb,
  path_tokens      text[]      GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
  version          text,
  owner_id         text,
  user_metadata    jsonb
);

CREATE INDEX IF NOT EXISTS name_prefix_search ON storage.objects USING btree (name text_pattern_ops);

CREATE TABLE IF NOT EXISTS storage.migrations (
  id          integer      NOT NULL,
  name        varchar(100) NOT NULL,
  hash        varchar(40)  NOT NULL,
  executed_at timestamp    DEFAULT CURRENT_TIMESTAMP
);

-- Permissions
GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role, supabase_storage_admin;
GRANT ALL   ON storage.buckets    TO supabase_storage_admin, service_role;
GRANT ALL   ON storage.objects    TO supabase_storage_admin, service_role;
GRANT ALL   ON storage.migrations TO supabase_storage_admin;
GRANT SELECT ON storage.buckets   TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, anon;

-- Agency-branding bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-branding',
  'agency-branding',
  true,
  2097152,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT DO NOTHING;
