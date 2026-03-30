#!/bin/bash
# Initialize Supabase roles for self-hosted Docker setup
# Runs as part of docker-entrypoint-initdb.d

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- Create roles needed by Supabase services
  CREATE ROLE supabase_auth_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}' SUPERUSER;
  CREATE ROLE supabase_storage_admin WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}' SUPERUSER;
  CREATE ROLE authenticator WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE ROLE postgres WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}' SUPERUSER;

  -- Grant role memberships
  GRANT anon TO authenticator;
  GRANT authenticated TO authenticator;
  GRANT service_role TO authenticator;

  -- Create schemas
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
  CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
  CREATE SCHEMA IF NOT EXISTS _realtime;
  GRANT ALL ON SCHEMA _realtime TO supabase_admin;

  -- Grant schema permissions
  GRANT ALL ON SCHEMA public TO supabase_auth_admin;
  GRANT ALL ON SCHEMA public TO supabase_storage_admin;
  GRANT ALL ON SCHEMA public TO authenticator;
  GRANT ALL ON SCHEMA public TO anon;
  GRANT ALL ON SCHEMA public TO authenticated;
  GRANT ALL ON SCHEMA public TO service_role;
  GRANT USAGE ON SCHEMA auth TO anon;
  GRANT USAGE ON SCHEMA auth TO authenticated;
  GRANT USAGE ON SCHEMA auth TO service_role;
EOSQL
