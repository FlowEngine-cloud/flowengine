# FlowEngine Portal OSS — Architecture & Project Overview

## What Is This Project?

FlowEngine Portal OSS is an **open-source replica of [FlowEngine.cloud](https://flowengine.cloud)** — the same product, self-hostable.

> **Important principle:** Everything in the OSS must mirror the FlowEngine experience. Features, flows, and UI should feel identical to FlowEngine. If something exists in FlowEngine, the OSS version should behave the same way. The OSS is not a stripped-down version — it is the same product, open-source.

It is a **white-label client portal for automation agencies**. Agencies self-host it, connect their instances, invite clients, and give those clients a branded dashboard to manage and interact with their automations — without ever exposing the underlying tools directly.

**One deployment = one agency + that agency's clients.** This is not a multi-tenant platform.

**Tech stack:** Next.js 15 · React 19 · TypeScript · Supabase (PostgreSQL + Auth + Storage) · Tailwind CSS · Radix UI · Framer Motion

---

## Users & Roles

| Role | Description |
|---|---|
| **Agency Owner** | Full control — manages instances, clients, branding, billing, team |
| **Team Members** | Agency employees with role-based access: `admin` / `manager` / `member` |
| **Clients** | End-customers invited by the agency — see only what is assigned to them |
| **Client Members** | Sub-users under a client account |

Team members transparently access the owner's data via `resolveEffectiveUserId()` — all queries resolve to the owner's ID on the backend.

---

## Instance Types & Manage Panels

The portal connects to multiple instance types. Each type renders its own dedicated manage panel:

| Instance Type | Source | `is_external` | Panel | Tabs / Features |
|---|---|---|---|---|
| **n8n** (FlowEngine-managed) | FlowEngine.cloud API | `false` | `ClientPanelContent` | Overview (executions), UI Components, Templates, Credentials, Services (WhatsApp), Payment, Settings |
| **n8n** (self-imported) | Manual URL + API key | `true` | `ClientPanelContent` | Same as above — Settings tab shows external URL input + toggle |
| **OpenClaw** | FlowEngine.cloud API | — | `OpenClawContent` | Overview (model + channels + gateway), Logs, Deployments, Diagnostics |
| **Website / Docker** | FlowEngine.cloud API | — | `WebsitePortalContent` | URL display, notes, link to Hosting page |

### Instance Sources

Instances reach the OSS from two origins:

1. **FlowEngine.cloud** — connected via API key in Settings → Platform. FlowEngine exposes instances from its internal `pay_per_instance_deployments` and `n8n_instances` (membership) tables via its API. The OSS pulls these in the background and merges them with local instances.
2. **Manual import** — the agency provides a URL + API key directly. Stored locally in the OSS database with `is_external: true`.

---

## Portal Sections

| Section | Route | Description |
|---|---|---|
| **Home** | `/portal` | All connected instances list with status |
| **Manage** | `/portal/[id]` | Per-instance panel — type-specific (see table above) |
| **Hosting** | `/portal/hosting` | Deploy and manage instances via FlowEngine.cloud or self-import |
| **Clients** | `/portal/clients` | Invite clients, assign instances, manage access per client |
| **Templates** | `/portal/templates` | Agency-level workflow template library (public + private, versioned) |
| **UI Studio** | `/portal/ui-studio` | No-code widget/component builder — forms, chatbots, embeds |
| **Settings** | `/portal/settings` | Branding, authentication, SMTP, Stripe, OAuth (n8n), FlowEngine API key, team |

---

## Integrations

### 1. FlowEngine.cloud (Optional)

FlowEngine.cloud is a **separate product** — the managed hosted version of this same portal. Separate codebase, separate database, separate users. The OSS can optionally connect to it as a hosting provider.

- Connected via `flowengine_api_key` in Settings → Platform
- The OSS pulls instances and WhatsApp sessions from the FE API
- No shared database, no shared users — all client/team/billing data is OSS-managed
- API client: [src/lib/flowengine.ts](../src/lib/flowengine.ts)

### 2. Supabase (Required)

Handles authentication, database, and file storage.

- **Auth (GoTrue)** — JWT-based login via email/password or OAuth (configured via Supabase Dashboard + enabled in portal Settings)
- **PostgreSQL** — all business data with Row-Level Security (RLS) enforced on all tables
- **Storage** — logos, widget designs, template assets
- Clients: [src/lib/supabaseAdmin.ts](../src/lib/supabaseAdmin.ts) (server-side) · [src/lib/supabaseClient.ts](../src/lib/supabaseClient.ts) (browser)

### 3. Login OAuth Providers (Optional)

Configured in Supabase Dashboard first, then toggled on in Settings → Authentication. Controls which sign-in buttons appear on the portal login page.

| Provider | Toggle |
|---|---|
| **Google** | `enable_google_auth` |
| **GitHub** | `enable_github_auth` |
| **LinkedIn** | `enable_linkedin_auth` |

Sign-up can also be restricted (`allow_signup: false`) so only invited users can log in.

### 4. n8n Workflow OAuth Providers (Optional)

Configured in Settings → OAuth. The agency registers one OAuth app per provider and the credentials are injected into connected n8n instances — so clients can authenticate with third-party services in one click, without needing their own OAuth apps.

| Provider | Services Covered |
|---|---|
| **Google** | Gmail, Google Sheets, Drive, Calendar, Docs, BigQuery, Analytics, Ads, Contacts, Chat, Tasks, Slides, Translate, Vertex AI (Gemini), Forms, Books, Business Profile, Cloud Storage, Perspective, Firebase Firestore, Firebase Realtime DB, Workspace Admin, Cloud Natural Language |
| **Microsoft** | Microsoft 365, OneDrive, Outlook, Teams, Calendar, Excel, SharePoint |
| **Slack** | Slack |
| **LinkedIn** | LinkedIn |
| **Reddit** | Reddit |
| **Twitter/X** | Twitter/X |

Credentials stored encrypted as JSONB in `portal_settings.oauth_credentials`. Client: [src/components/settings/OAuthSettings.tsx](../src/components/settings/OAuthSettings.tsx)

### 5. n8n (Optional)

The underlying workflow automation engine. Connected per-instance via URL + API key.

- Workflows — list, view, execute with input data
- Executions — history, logs, live status
- Credentials — manage n8n credentials per instance
- Node types — available nodes in the instance
- Template deployment
- API wrapper: [src/lib/n8nInstanceApi.ts](../src/lib/n8nInstanceApi.ts)

### 6. Stripe (Optional)

Client billing and subscription management.

- Create checkout sessions (portal-only, 10GB / 30GB / 50GB storage tiers)
- Manage customer subscriptions (monthly + annual)
- Stripe billing portal for self-service
- Webhook handler for payment events
- Coupon validation
- Client: [src/lib/stripe.ts](../src/lib/stripe.ts)

### 7. SMTP / Email (Optional)

Used for client invitations and notifications via Nodemailer.

- Supports a **global SMTP** config (env vars)
- Supports **per-agency SMTP** (stored encrypted in `profiles`)
- Client: [src/lib/emailService.ts](../src/lib/emailService.ts)

### 8. OpenAI-Compatible AI (Optional)

Used by UI Studio for AI-assisted widget generation.

- Supports any OpenAI-compatible API — OpenRouter, Ollama, OpenAI, etc.
- Configured via `AI_BASE_URL` + `AI_API_KEY` in portal Settings

---

## Database (Key Tables)

| Table | Purpose |
|---|---|
| `profiles` | Agency owner + client accounts |
| `team_members` | Agency team (owner → member relationships + roles) |
| `pay_per_instance_deployments` | All deployed/imported instances — billing, status, soft-deletes |
| `n8n_instances` | Legacy membership-tier dedicated instances |
| `client_instances` | Which clients can access which instances + access level |
| `client_invites` | Pending invitations with tokens |
| `client_widgets` | Widgets assigned to clients |
| `workflow_templates` | Template library (versioned, public or team-scoped) |
| `whatsapp_instances` | WhatsApp sessions linked to instances |
| `conversations` | AI chat history |
| `portal_settings` | Single-row config — SMTP, Stripe, FlowEngine key, OAuth credentials, auth settings |

All tables use **Row-Level Security (RLS)**. All API keys and secrets are **encrypted at rest** with AES-256-CBC ([src/lib/encryption.ts](../src/lib/encryption.ts)).

---

## Key Architectural Facts

- **Single-agency** — one deployment serves one agency and its clients
- **OSS mirrors FlowEngine** — features and UX must stay in sync with the FlowEngine product
- **FlowEngine.cloud is separate** — connecting to it is optional; no shared DB or users
- **n8n is optional** — the portal works without it; other instance types (OpenClaw, Website) have their own panels
- **Encryption at rest** — all API keys/secrets encrypted with AES-256-CBC before storing
- **RLS enforced** — clients only see data explicitly assigned to them
- **Team access resolution** — team members resolve to the owner's ID transparently on all queries
