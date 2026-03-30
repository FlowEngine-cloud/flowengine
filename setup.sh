#!/usr/bin/env bash
# FlowEngine Portal - Quick-start setup script
#
# Usage:
#   ./setup.sh          ← build from source (development / contributors)
#   ./setup.sh --prod   ← pull pre-built image from ghcr.io (recommended for production)
set -e

PROD=false
if [[ "$1" == "--prod" ]]; then
  PROD=true
fi

# Create the 'coolify' bridge network if it doesn't exist.
# On Coolify/Traefik hosts this network already exists and Traefik uses it for HTTPS routing.
# On standalone hosts this creates a local bridge network (harmless).
docker network create coolify 2>/dev/null && echo "✅ Created 'coolify' network" || echo "ℹ️  'coolify' network already exists"

# Copy .env template on first run
if [ ! -f .env ]; then
  cp .env.docker .env
  echo ""
  echo "✅ Created .env from .env.docker"
  echo ""
  echo "⚠️  Open .env and set:"
  echo "   POSTGRES_PASSWORD  — strong random password"
  echo "   JWT_SECRET         — openssl rand -base64 32"
  echo "   ANON_KEY / SERVICE_ROLE_KEY — https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys"
  echo "   SITE_URL           — public URL (e.g. https://portal.yourdomain.com)"
  echo "   PORTAL_DOMAIN      — same domain without https:// (Traefik only, leave empty otherwise)"
  echo ""
  echo "Then re-run:  ./setup.sh${PROD:+ --prod}"
  exit 0
fi

if [ "$PROD" = true ]; then
  echo "🚀 Starting FlowEngine Portal (pre-built image)..."
  docker compose -f docker-compose.prod.yml pull portal
  docker compose -f docker-compose.prod.yml up -d
else
  echo "🚀 Starting FlowEngine Portal (building from source)..."
  docker compose up -d --build
fi

SITE_URL=$(grep '^SITE_URL=' .env | cut -d= -f2)
echo ""
echo "✅ FlowEngine Portal is running!"
echo "   Open: ${SITE_URL:-http://localhost:3000}"
