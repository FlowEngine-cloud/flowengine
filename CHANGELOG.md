# Changelog

All notable changes to FlowEngine Portal are documented here.

Format: `## vX.Y.Z — YYYY-MM-DD`

---

## v1.1.0 — 2026-03-23

### Added
- **MCP server support** — `/api/mcp/{portals,instances,workflows,components,clients}` routes for Claude MCP integration via `fp_` API keys
- **API keys** — portal-specific `fp_` keys (Settings → API Keys) for programmatic access and MCP server auth
- **AI tokens tab gate** — AI tokens tab shows a "Connect FlowEngine" prompt when no FlowEngine API key is configured; real token data when connected
- **AI payer switching** — `POST /api/n8n/update-ai-payer` lets agencies choose whether the agency or client pays for AI usage per instance
- **E2E test suite** — Playwright tests covering API key auth guards and all MCP route response shapes
- **`docker-compose.prod.yml`** — pre-built image production compose file with Watchtower for auto-updates
- **GitHub Actions** — Docker image publish workflow on push to `main`
- **`scripts/release.sh`** — automated version bump + tag + changelog helper

### Changed
- Dev server runs on port **3001** (avoids conflict with FlowEngine on 3000)
- Schema: `pay_per_instance_deployments` now has `ai_payer TEXT DEFAULT 'agency' CHECK (ai_payer IN ('agency', 'client'))`

---

## v1.0.0 — 2026-03-23

Initial public release.

- White-labeled client portal for automation agencies
- Self-hosted Supabase stack (Postgres, Auth, Storage, Realtime, Kong)
- n8n instance management — browse, trigger, and manage workflows
- Client management — invite clients, assign instances, role-based access
- Hosting management — deploy n8n, OpenClaw, Docker, or link external instances
- Template library — import/export n8n workflow templates
- UI Studio — build embeddable chatbots and widgets without code
- Settings — branding, SMTP, Stripe, Google/GitHub OAuth
- WhatsApp session management via Evolution API
- AES-256 encryption for all stored credentials
- Docker Compose with multi-platform image (amd64 + arm64)
- Traefik / Coolify integration with automatic HTTPS
