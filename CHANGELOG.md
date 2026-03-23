# Changelog

All notable changes to FlowEngine Portal are documented here.

Format: `## vX.Y.Z — YYYY-MM-DD`

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
