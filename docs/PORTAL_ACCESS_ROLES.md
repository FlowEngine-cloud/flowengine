# FlowEngine Portal — Access Control & Roles

Complete reference for every persona, role, page, tab, and feature visible in the portal.

---

## 1. The Two Sides

The portal has two completely separate sides:

| Side | Who | Determined by |
|---|---|---|
| **Company** | The business running the portal + their internal team | Owns instances in `pay_per_instance_deployments` or `n8n_instances`, or is in `team_members` |
| **Client** | End-clients invited to access specific instances | Record in `client_instances` (agency-paid) or `invited_by_user_id` set on their own instance |

---

## 2. Company Side — Roles

Company users share a single owner account. Team members are added via **Settings → Company → Team Members** and stored in the `team_members` table.

### Role Definitions

| Role | Description |
|---|---|
| `owner` | The account holder. Full unrestricted access. |
| `admin` | Same capabilities as owner — can manage billing, team, all settings. |
| `manager` | Can deploy, delete, invite clients, manage instances. Cannot manage billing or add/remove team members. |
| `member` | Read-only. Can view everything but cannot create, delete, deploy, or manage anything. |

### Permission Matrix — Company

| Permission | owner | admin | manager | member |
|---|---|---|---|---|
| View all pages | ✅ | ✅ | ✅ | ✅ |
| Deploy / connect instances | ✅ | ✅ | ✅ | ❌ |
| Delete / stop instances | ✅ | ✅ | ✅ | ❌ |
| Invite / remove clients | ✅ | ✅ | ✅ | ❌ |
| Create / edit widgets | ✅ | ✅ | ✅ | ❌ |
| Manage credentials | ✅ | ✅ | ✅ | ❌ |
| View billing & payments | ✅ | ✅ | ❌ | ❌ |
| Charge clients via Stripe | ✅ | ✅ | ❌ | ❌ |
| Add / remove team members | ✅ | ✅ | ❌ | ❌ |
| Change branding / settings | ✅ | ✅ | ❌ | ❌ |

**Code reference:** `canWrite(role)` → returns false for `member`; `canManageBilling(role)` and `canManageTeam(role)` → return true only for `owner` and `admin`. See [src/lib/teamUtils.ts](src/lib/teamUtils.ts).

---

## 3. Client Side — Types

Clients are invited users with access to specific instances. There are two access levels:

| Type | How determined | Example |
|---|---|---|
| **Full Access Client** | `client_instances.allow_full_access = true` OR client owns their instance (`pay_per_instance_deployments.user_id` = client, `invited_by_user_id` = agency) | Client paid for their own instance; agency manages it |
| **Simplified Client** | `client_instances.allow_full_access = false` | Agency owns instance, gave client a read/interact dashboard only |

### Client Role Definitions

Each client account can also have team members (e.g. multiple people in the client's company). These are stored in `team_members` with `owner_id` = client's user ID.

| Role | Description |
|---|---|
| `admin` | Full access within the client account |
| `manager` | Can manage instances and workflows, cannot change billing |
| `member` | Read-only within the client account |

---

## 4. Sidebar Navigation

| Nav Item | Company (all roles) | Full Access Client | Simplified Client |
|---|---|---|---|
| **Manage** (dashboard) | ✅ | ✅ | ✅ |
| **Hosting** (instance mgmt) | ✅ | ✅ | ❌ |
| **Services** (WhatsApp etc.) | ✅ | ✅ | ❌ |
| **Clients** | ✅ | ❌ | ❌ |
| **Templates** | ✅ | ❌ | ❌ |
| **Embeds** (UI Studio) | ✅ | ❌ | ❌ |
| **Settings** | ✅ | ❌ | ❌ |

**Note:** Company `member` role sees all nav items but most actions within each page are disabled/hidden.

---

## 5. Manage Page — Instance Tabs

When an instance is selected in the Manage view, these tabs appear:

| Tab | Company | Full Access Client | Simplified Client |
|---|---|---|---|
| **Overview** | ✅ | ✅ | ✅ |
| **UI Embeds** (widgets) | ✅ | ✅ (their components only) | ✅ (their components only) |
| **Templates** | ✅ | ✅ | ✅ |
| **Credentials** | ✅ | ✅ | ✅ |
| **Services** | ✅ | ✅ | ✅ |
| **Settings** | ✅ | ✅ | ✅ |
| **Open n8n** button | ✅ | ✅ | ❌ |
| **Deploy / manage** button | ✅ | ✅ | ❌ |
| "All Instances" dropdown | ✅ (owner/admin/manager/member) | ❌ (see only their instances) | ❌ |
| Filter by client email | ✅ (owner/admin/manager) | ❌ | ❌ |

---

## 6. Hosting Page

| Feature | Company (owner/admin/manager) | Company (member) | Full Access Client | Simplified Client |
|---|---|---|---|---|
| **View instances list** | ✅ | ✅ | ✅ (their instances only) | ❌ |
| **Deploy new instance** button | ✅ | ❌ | ❌ | ❌ |
| **Connect external instance** | ✅ | ❌ | ❌ | ❌ |
| **Filter by client email** | ✅ | ✅ | ❌ | ❌ |
| **Instance detail page** | ✅ | ✅ (read-only) | ✅ (their instances) | ❌ |

---

## 7. Services Page

| Feature | Company (owner/admin/manager) | Company (member) | Full Access Client | Simplified Client |
|---|---|---|---|---|
| **View WhatsApp connections** | ✅ | ✅ | ✅ (linked to their instances) | ❌ |
| **Add new WhatsApp connection** | ✅ | ❌ | ❌ | ❌ |
| **Configure connection** | ✅ | ❌ | ❌ | ❌ |
| **API Builder** | ✅ | ✅ (read-only) | ✅ | ❌ |
| **Filter by client email** | ✅ | ✅ | ❌ | ❌ |

---

## 8. Clients Page (Company only)

Clients can never access this page. Only company users see it.

### Client List View

| Feature | owner / admin | manager | member |
|---|---|---|---|
| View client list | ✅ | ✅ | ✅ |
| Add client (name-only, no email) | ✅ | ✅ | ❌ |
| Invite client by email | ✅ | ✅ | ❌ |
| Search / filter clients | ✅ | ✅ | ✅ |

### Client Detail Tabs (`/portal/clients/[id]`)

| Tab | Contents | owner / admin | manager | member |
|---|---|---|---|---|
| **Overview** | Quick stats, recent transactions | ✅ | ✅ | ✅ |
| **Properties** | Client info, notes, linked instances, WhatsApp services, external entries | ✅ | ✅ | ✅ (read) |
| **AI Tokens** | Client AI budget, per-instance AI payer toggle, topup via Stripe | ✅ | ✅ | ✅ (read) |
| **Team Members** | Invite / manage team members for this client account | ✅ | ❌ | ❌ |
| **Payments** | Stripe billing, manual payments, transactions | ✅ | ❌ | ❌ |

#### Properties Sub-sections

| Sub-section | Contents |
|---|---|
| Instances | Linked instances with status, revoke/resign access |
| Services | Linked WhatsApp connections |
| External | Custom entries (non-instance relationships) |
| Notes | Internal notes visible only to agency |

#### Payments Sub-sections

| Sub-section | Contents |
|---|---|
| Billing | Link Stripe customer, charge/invoice/subscription actions |
| Transactions | Stripe transaction history with receipt/invoice links |
| Manual Payments | Off-Stripe payments (bank transfer, cash, crypto, check) |
| Settings | Monthly expected amount, internal contract notes |
| Platform Costs | AI token usage costs per instance |

---

## 9. Templates Page

| Feature | Company (all roles) | Full Access Client | Simplified Client |
|---|---|---|---|
| View template library | ✅ | ❌ | ❌ |
| Browse / search templates | ✅ | ❌ | ❌ |
| Install template to instance | ✅ (owner/admin/manager) | ❌ | ❌ |
| Edit / delete templates | ✅ (owner/admin) | ❌ | ❌ |

---

## 10. Embeds / UI Studio Page

| Feature | Company (all roles) | Full Access Client | Simplified Client |
|---|---|---|---|
| View component templates | ✅ | ❌ | ❌ |
| Create button / form / chatbot templates | ✅ (owner/admin/manager) | ❌ | ❌ |
| Edit / delete templates | ✅ (owner/admin/manager) | ❌ | ❌ |
| Assign templates to instances | ✅ (owner/admin/manager) | ❌ | ❌ |

---

## 11. Settings Page (Company only)

Clients never see the Settings nav item or page.

### Settings Tab: Account

| Section | Contents | All company roles |
|---|---|---|
| Account Settings | Display name, email, password, avatar | ✅ (own account only) |

### Settings Tab: Company

| Section | Contents | owner / admin | manager | member |
|---|---|---|---|---|
| **Team Members** | Invite team members, set roles, remove members | ✅ | ❌ | ❌ |
| **Name and Logo** | Business name, agency logo (white-label branding) | ✅ | ❌ | ❌ |
| **Authentication** | Email auto-confirm, allowed domains, OAuth providers | ✅ | ❌ | ❌ |

### Settings Tab: Connections

| Section | Contents | owner / admin | manager | member |
|---|---|---|---|---|
| **FlowEngine API** | API key for managed hosting (one-click deploys) | ✅ | ❌ | ❌ |
| **AI Provider** | LLM provider key for AI workflow generation | ✅ | ❌ | ❌ |
| **Stripe** | Agency Stripe secret key for client billing | ✅ | ❌ | ❌ |
| **Email SMTP** | SMTP credentials for invitation and notification emails | ✅ | ❌ | ❌ |

### Settings Tab: OAuth

| Section | Contents | owner / admin | manager | member |
|---|---|---|---|---|
| **Google** | Google OAuth app credentials | ✅ | ❌ | ❌ |
| **Microsoft** | Microsoft OAuth app credentials | ✅ | ❌ | ❌ |
| **Slack** | Slack OAuth app credentials | ✅ | ❌ | ❌ |
| **LinkedIn** | LinkedIn OAuth app credentials | ✅ | ❌ | ❌ |
| **Reddit** | Reddit OAuth app credentials | ✅ | ❌ | ❌ |
| **Twitter/X** | Twitter OAuth app credentials | ✅ | ❌ | ❌ |

### Settings Tab: API & MCP

| Section | Contents | owner / admin | manager | member |
|---|---|---|---|---|
| **API Key** | Generate / revoke portal API keys | ✅ | ❌ | ❌ |
| **MCP Server** | MCP server config for Claude Code integration | ✅ | ❌ | ❌ |
| **API Docs** | Interactive API documentation | ✅ | ✅ (read) | ✅ (read) |

---

## 12. Branding — What Each Persona Sees

| Persona | Logo shown | Business name shown |
|---|---|---|
| Company user (any role) | Their own uploaded logo (or default FlowEngine logo) | Their `business_name` from `profiles` |
| Full Access Client | Their agency's logo | Their agency's `business_name` |
| Simplified Client | Their agency's logo | Their agency's `business_name` |

**How it works:**
- Logo and business name are stored in `profiles.agency_logo_url` and `profiles.business_name`
- Company users fetch their own profile directly
- Clients fetch their agency's profile via `/api/portal/branding` (server-side, bypasses RLS, looks up `client_instances.invited_by`)
- Logo is cached in `localStorage` under key `flowengine_agency_logo` for 24 hours

---

## 13. Role Detection Logic

### Company vs Client detection (`usePortalRole`)

```
1. Does user own any pay_per_instance_deployments?  → role = 'agency' (company)
2. Does user own any n8n_instances?                 → role = 'agency' (company)
3. Is user in team_members (accepted)?              → role = 'agency' (company)
4. Is user in client_instances?                     → role = 'client'
5. None of the above                                → role = 'free' (treated as company with no instances)
```

**Note:** `free` is only present in the codebase because someone may have registered but not yet set up anything. In the self-hosted OSS portal there is no paid "free tier" — everyone is either an operator (company) or a client.

### Full Access vs Simplified Client detection

Determined by `client_instances.allow_full_access` boolean on the specific instance record.

| `allow_full_access` | Client type |
|---|---|
| `true` | Full Access Client — sees Hosting, Services |
| `false` (default) | Simplified Client — sees Manage only |

### Company Team Role detection (`useTeamContext`)

Calls the Supabase RPC `get_effective_owner_id` which returns:
- `owner_id`: the team owner's user ID (used for all data queries)
- `is_team_member`: boolean
- `team_role`: `'owner' | 'admin' | 'manager' | 'member'`

---

## 14. Database Tables Reference

| Table | Purpose |
|---|---|
| `profiles` | User profile — `agency_logo_url`, `business_name`, `agency_stripe_key_encrypted` |
| `team_members` | Company team — `owner_id`, `member_id`, `role`, `status` |
| `pay_per_instance_deployments` | Instances — `user_id` (owner), `invited_by_user_id` (agency manager), `service_type`, `allow_full_access` |
| `n8n_instances` | Membership instances |
| `client_instances` | Client→instance links — `user_id` (client), `instance_id`, `invited_by` (agency), `allow_full_access` |
| `client_invites` | Invitation records — `token`, `email`, `invited_by`, `accepted_by`, `status`, `allow_full_access` |
| `whatsapp_instances` | WhatsApp service connections |
| `agency_client_billing_settings` | Per agency-client billing config — `monthly_expected_amount`, `notes` |
| `agency_manual_payments` | Off-Stripe payment records |

---

## 15. Known Gaps (Currently Broken / Not Yet Implemented)

| Issue | Impact | Fix needed |
|---|---|---|
| `/api/portal/branding` endpoint missing | Clients always see default FlowEngine logo/name instead of agency branding | Create endpoint that looks up `client_instances.invited_by` → fetches agency `profiles` |
| `usePortalRole` does not distinguish full vs simplified client | Sidebar shows only Manage for ALL clients | Add `allowFullAccess` to role info; check `client_instances.allow_full_access` |
| Sidebar shows only Manage for clients | Full access clients cannot navigate to Hosting or Services | Filter sidebar items based on `allowFullAccess` flag |
| Services layout blocks ALL clients | Full access clients get redirected to `/portal` when visiting Services | Change guard to only redirect simplified clients |
| Hosting layout: Deploy button hidden but accessible to all clients | Full access clients can view Hosting but not simplified clients — correct for now but no guard | Add guard to redirect simplified clients |
