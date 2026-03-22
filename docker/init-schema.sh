#!/bin/bash
# Wait for Supabase auth roles to be set up by the postgres image,
# then apply the application schema and portal settings migration.
set -e

echo "Applying FlowEngine schema..."
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres <<-'EOSQL'
  -- Create the auth schema stub if it doesn't exist yet
  -- (supabase/postgres image creates it, but just in case)
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
  );
EOSQL

# Apply the main schema
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres -f /docker-entrypoint-initdb.d/01-schema.sql

# Apply portal settings
psql -v ON_ERROR_STOP=1 --username postgres --dbname postgres -f /docker-entrypoint-initdb.d/02-portal-settings.sql

echo "FlowEngine schema applied successfully."
