# FlowEngine Portal

An open-source client portal for automation agencies. Give your clients a white-labeled dashboard to access their n8n workflows, chatbots, and widgets — without touching n8n directly.

## What It Does

You run this portal. Your clients log in and see only what you give them access to. You manage everything from behind the scenes.

---

## Portal Tabs

### Manage
Your main workspace. Connect to an n8n instance and control everything from one place:
- Browse and trigger workflows
- View and manage credentials
- See active executions and logs
- Manage WhatsApp sessions (if connected via Evolution API)
- Build and publish chatbot widgets

### Hosting
Deploy and manage instances. Supports:
- **n8n** — connect your own self-hosted instance or deploy via FlowEngine managed hosting
- **OpenClaw** — multi-channel bot platform (Telegram, Discord, Slack) — requires 30GB+ storage
- **Docker / Website** — deploy any Docker image or static site
- **Connect external** — link any existing instance via URL + API key

Each instance shows live status, URL, and service type. Deleted instances stay visible so subscriptions can be managed and redeployed.

### Services
Connect third-party integrations and external services to your portal.

### Clients
Invite clients and control what they see:
- Add clients by name and email (email optional)
- Assign which instances a client can access
- Clients get their own login and see only their assigned instances
- Full-access mode or read-only depending on your settings

### Templates
A library of n8n workflow templates. Browse, preview, and deploy directly to connected instances. Supports importing from URL or uploading JSON.

### Embeds (UI Studio)
Build embeddable widgets without writing code:
- Chatbots connected to n8n workflows
- Forms that trigger automations
- Custom UI elements
- Preview and copy embed code
- Publish as standalone pages or iframe embeds

### Settings
Configure the portal itself:
- **Branding** — logo, colors, custom name
- **Authentication** — Google/GitHub OAuth, signup restrictions
- **SMTP** — email for client invitations
- **Stripe** — connect your Stripe account to bill clients
- **FlowEngine API** — connect to managed hosting (optional)
- **Team** — invite team members with role-based access

---

## Deploy (Docker Compose — includes self-hosted Supabase)

This is the recommended path. Everything runs in one stack — no external Supabase account needed.

```bash
git clone https://github.com/FlowEngine-cloud/Flowengine.git
cd Flowengine
./setup.sh
```

`setup.sh` copies `.env.docker` → `.env`, creates the Docker network, and starts the stack.

Edit `.env` with your domain and passwords, then:

```bash
docker compose up -d --build
```

Open `http://your-server:3000` (or your domain if using Traefik).

### With a custom domain (Traefik / Coolify)

Set `PORTAL_DOMAIN=portal.yourdomain.com` in `.env`. The stack includes Traefik labels for automatic HTTPS via Let's Encrypt.

---

## Deploy (External Supabase)

If you already have a Supabase project:

```bash
cp .env.example .env.local
# Fill in your Supabase URL and keys
npm install
npm run build
npm start
```

Run the migration in your Supabase SQL editor:
```bash
migrations/supabase-schema.sql
```

---

## Environment Variables

### Required (always)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (or your SITE_URL for self-hosted) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ENCRYPTION_SECRET` | 32-char secret for encrypting stored API keys. Generate: `openssl rand -hex 32` |

### Optional

| Variable | Description |
|---|---|
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email for client invitations |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe for client billing |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | AI assistant in UI Studio (OpenAI-compatible — OpenRouter, Ollama, etc.) |
| `FLOWENGINE_API_KEY` | Connect to FlowEngine managed hosting (see Settings → FlowEngine API) |

> Most settings (Stripe keys, SMTP, branding, n8n connection) are configured through the portal Settings UI after first login — not env vars.

---

## Security

- All stored API keys (Stripe, SMTP passwords, n8n keys) are encrypted at rest using AES-256 via `ENCRYPTION_SECRET`
- Client sessions use Supabase PKCE auth flow
- Row-level security enforced in the database — clients can only query their own data
- Stripe and SMTP credentials are never exposed to the browser
- No telemetry, no analytics, no data sent to third parties

---

## FlowEngine Managed Hosting (Optional)

The portal works with any self-hosted n8n. Optionally, you can connect to [FlowEngine](https://flowengine.cloud) for managed instance hosting with automatic SSL, backups, WhatsApp, and OpenClaw multi-channel bots. Set your API key in Settings → FlowEngine API.

---

## Tech Stack

- **Next.js 15** + React 19 (App Router)
- **Supabase** — auth (GoTrue), database (PostgreSQL), storage
- **Tailwind CSS 4**
- **Stripe** (optional)
- **Docker** with self-hosted Supabase stack

## License

MIT with Commons Clause — free to self-host, not for resale as a hosted service.
