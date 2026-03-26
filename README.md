# FlowEngine

If you deploy AI agents or automations for clients, FlowEngine gives you one place to manage your instances and deliver them under your own brand. Your clients never see the tools you use behind the scenes. They get a professional portal with visibility into what runs, under your name, connected to your Stripe.

**Demo:** https://demo.flowengine.cloud

[![Watch the demo](https://img.youtube.com/vi/LbVA6NYQqG4/maxresdefault.jpg)](https://www.youtube.com/watch?v=LbVA6NYQqG4)

---

## What It Does

You run the portal. Your clients log in and see only what you give them access to. You manage everything from behind the scenes.

---

## Portal Tabs

### Manage
Your main workspace. Connect to an n8n instance and control everything from one place:
- Browse and trigger workflows
- View and manage credentials
- See active executions and logs
- Manage WhatsApp sessions (if connected via Evolution API)
- Build and publish UI embeds

### Hosting
Deploy and manage instances. Supports:
- **n8n** - connect your own self-hosted instance or deploy via FlowEngine managed hosting
- **OpenClaw** - multi-channel bot platform (Telegram, Discord, Slack) - requires 30GB+ storage
- **Docker / Website** - deploy any Docker image or static site
- **Connect external** - link any existing instance via URL + API key

Each instance shows live status, URL, and service type. Deleted instances stay visible so subscriptions can be managed and redeployed.

### Services
Connect third-party integrations and external services to your portal.

### Clients
Invite clients and control what they see:
- Add clients by name and email (email optional)
- Assign which instances a client can access
- Clients get their own login and see only their assigned instances
- Full-access or read-only depending on your settings

### Templates
A library of n8n workflow templates. Browse, preview, and deploy directly to connected instances. Supports importing from URL or uploading JSON.

### UI Studio
Build embeddable UI without writing code:
- Chatbots connected to n8n workflows
- Forms that trigger automations
- Custom UI elements
- Preview and copy embed code
- Publish as standalone pages or iframe UI embeds

### Settings
Configure the portal itself:
- **Branding** - logo, colors, custom name
- **Authentication** - Google/GitHub OAuth, signup restrictions
- **SMTP** - email for client invitations
- **Stripe** - connect your Stripe account to bill clients
- **FlowEngine API** - connect to managed hosting (optional)
- **Team** - invite team members with role-based access

---

## Deploy

### Option 1: Docker Compose - build from source

Everything runs in one stack - no external Supabase account needed.

```bash
git clone https://github.com/FlowEngine-cloud/flowengine.git
cd flowengine
./setup.sh
```

`setup.sh` copies `.env.docker` to `.env`, creates the Docker network, and starts the stack.

Edit `.env` with your domain and passwords, then:

```bash
docker compose up -d --build
```

Open `http://your-server:3001` (or your domain if using Traefik).

Set `PORTAL_DOMAIN=portal.yourdomain.com` in `.env` for automatic HTTPS via Let's Encrypt (requires Traefik).

---

### Option 2: Pre-built Docker image (recommended for production)

Uses the image published to `ghcr.io/flowengine-cloud/flowengine` - no build step, faster setup.

```bash
git clone https://github.com/FlowEngine-cloud/flowengine.git
cd flowengine
./setup.sh --prod
```

Or manually:

```bash
cp .env.docker .env   # edit .env first
docker compose -f docker-compose.prod.yml up -d
```

**Updating:** Watchtower is included and checks for a new image every hour. It will pull and redeploy automatically. To update manually:

```bash
docker compose -f docker-compose.prod.yml pull portal
docker compose -f docker-compose.prod.yml up -d portal
```

To pin a specific version, set `IMAGE_TAG=v0.1.0` in your `.env`.

---

### Option 3: Coolify

1. In Coolify, create a new **Docker Compose** service
2. Source: **GitHub** - `FlowEngine-cloud/flowengine`
3. Compose file: `docker-compose.prod.yml`
4. Add your environment variables from `.env.docker`
5. Deploy

Coolify will automatically redeploy when the `latest` image is updated (set **Watch for image changes** in the service settings).

---

### Option 4: Digital Ocean Droplet

```bash
# 1. Create a Droplet (Ubuntu 22.04, 2GB+ RAM recommended)
# 2. SSH in and install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone and configure
git clone https://github.com/FlowEngine-cloud/flowengine.git
cd flowengine
./setup.sh --prod

# 4. Edit .env, then start
docker compose -f docker-compose.prod.yml up -d
```

For HTTPS, point your domain to the Droplet IP and set `PORTAL_DOMAIN` in `.env` (requires a reverse proxy like Nginx Proxy Manager or Traefik).

---

### Option 5: External Supabase

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

### Required

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
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | AI assistant in UI Studio (OpenAI-compatible - OpenRouter, Ollama, etc.) |
| `FLOWENGINE_API_KEY` | Connect to FlowEngine managed hosting (see Settings - FlowEngine API) |

> Most settings (Stripe keys, SMTP, branding, n8n connection) are configured through the portal Settings UI after first login - not env vars.

---

## Security

- All stored API keys (Stripe, SMTP passwords, n8n keys) are encrypted at rest using AES-256 via `ENCRYPTION_SECRET`
- Client sessions use Supabase PKCE auth flow
- Row-level security enforced in the database - clients can only query their own data
- Stripe and SMTP credentials are never exposed to the browser
- No telemetry, no analytics, no data sent to third parties

---

## FlowEngine Managed Hosting (Optional)

The portal works with any self-hosted n8n. Optionally, you can connect to [FlowEngine](https://flowengine.cloud) for managed instance hosting with automatic SSL, backups, WhatsApp, and OpenClaw multi-channel bots. Set your API key in Settings - FlowEngine API.

---

## Tech Stack

- **Next.js 15** + React 19 (App Router)
- **Supabase** - auth (GoTrue), database (PostgreSQL), storage
- **Tailwind CSS 4**
- **Stripe** (optional)
- **Docker** with self-hosted Supabase stack

## License

MIT with Commons Clause - free to self-host, not for resale as a hosted service.
