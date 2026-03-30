#!/bin/sh
# Runtime env injection for Next.js standalone
#
# Next.js bakes NEXT_PUBLIC_* values at build time. The pre-built GHCR image
# uses placeholder values so it can be deployed to any domain. This script
# replaces those placeholders with the real values from the container env
# before the server starts.
#
# Placeholders baked during image build (see Dockerfile):
#   NEXT_PUBLIC_SUPABASE_URL  → https://placeholder.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY → eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder
#   NEXT_PUBLIC_APP_URL       → http://localhost:3000

set -e

STATIC_DIR="/app/.next/static"

replace() {
  local OLD="$1"
  local NEW="$2"
  if [ -z "$NEW" ] || [ "$OLD" = "$NEW" ]; then
    return
  fi
  find "$STATIC_DIR" -type f -name "*.js" | xargs -r sed -i "s|${OLD}|${NEW}|g" 2>/dev/null || true
}

replace "https://placeholder.supabase.co" "${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:3000}"
replace "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder" "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
replace "http://localhost:3000" "${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

exec node server.js
