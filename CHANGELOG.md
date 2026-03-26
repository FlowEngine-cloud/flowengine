# Changelog

All notable changes to FlowEngine Portal are documented here.

Format: `## vX.Y.Z — YYYY-MM-DD`

---

## v0.1.0 — 2026-03-26

Initial open-source release.

- White-labeled client portal for automation agencies
- Self-hosted Supabase stack (Postgres, Auth, Storage, Realtime, Kong)
- n8n instance management — browse, trigger, and manage workflows
- Client management — invite clients, assign instances, role-based access
- Hosting management — deploy n8n, OpenClaw, Docker, or link external instances
- Template library — import/export n8n workflow templates
- UI Studio — build embeddable chatbots and widgets without code
- MCP server — `/api/mcp/*` routes for Claude integration via `fp_` API keys
- API keys — portal-specific `fp_` keys for programmatic access
- Settings — branding, SMTP, Stripe, Google/GitHub OAuth
- WhatsApp session management via Evolution API
- AES-256 encryption for all stored credentials
- Docker Compose with multi-platform image (amd64 + arm64)
- Traefik / Coolify / Digital Ocean support with automatic HTTPS
