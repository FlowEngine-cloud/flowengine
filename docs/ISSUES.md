# OSS Portal — Known Issues & Fix Backlog

Audited 2026-03-25. Issues found by reviewing architecture vs actual implementation.

---

## 🔴 Critical

### [ISSUE-01] Client invite accepts without email verification
**File:** `src/app/api/invite/accept-access/route.ts`
Anyone who obtains the invite token can accept it as a different user and gain instance access. The team invite flow enforces email match; the client access flow was copied without it.
**Fix:** Add `user.email !== invite.email` check to the POST handler.
**Status:** ✅ Fixed

---

## 🟠 High

### [ISSUE-02] Widget Studio entirely broken for team members
**Files:** `src/app/api/widget-studio/templates/[id]/route.ts`, all widget-studio endpoints
All widget-studio APIs use `user.id` directly instead of `resolveEffectiveUserId`. Team members fail all ownership checks because `instance.user_id` is the owner's ID.
**Fix:** Apply `resolveEffectiveUserId` at the top of every widget-studio handler.
**Status:** ✅ Fixed

### [ISSUE-03] `allow_signup: false` blocks invited users from creating accounts
**Files:** `src/app/invite/accept-team/page.tsx`, `src/app/invite/accept-access/page.tsx`, `src/components/Auth.tsx`
Agencies disabling public signup (the default) break both invite flows. Invited users who don't yet have accounts cannot sign up.
**Fix:** Pass a `lockedEmail` + force-show signup mode when arriving from an invite page.
**Status:** ✅ Fixed

### [ISSUE-04] "Client Members" (sub-users) are completely unimplemented
**Architecture says:** Client Members — sub-users under a client account.
**Reality:** No table, no API, no UI. Entirely absent.
**Fix:** Descope from architecture doc or implement. Marked for later sprint.
**Status:** 🔲 Backlog

### [ISSUE-05] `member` role can perform write operations
**Files:** `src/app/api/client/invite/route.ts`, `src/app/api/client-panel/[instanceId]/assign-client/route.ts`
Endpoints use `resolveEffectiveUserId` without calling `canWrite()`. Read-only `member` role can invite clients and assign instances.
**Fix:** Add `canWrite(role)` guard using `getEffectiveOwnerId` (which returns role) instead of `resolveEffectiveUserId`.
**Status:** ✅ Fixed

---

## 🟡 Medium

### [ISSUE-06] Team invite tokens never expire
**File:** `migrations/supabase-schema.sql`, `src/app/api/team/invite/route.ts`
`team_members` has no `expires_at` column. Pending team invites are valid forever. Client invites expire in 30 days.
**Fix:** Add `expires_at` column to `team_members`; set 7-day expiry on invite; check on accept.
**Status:** ✅ Fixed

### [ISSUE-07] Middleware is a complete dead no-op
**File:** `src/middleware.ts`
`DEMO_ALLOWLIST` is defined but the function returns `NextResponse.next()` unconditionally. All middleware logic copied from FlowEngine was never wired up.
**Fix:** Either implement proper demo-mode gating or remove the dead code cleanly.
**Status:** ✅ Fixed

### [ISSUE-08] Resend invite uses non-existent `/invite/accept` route
**File:** `src/app/api/client/invite/resend/route.ts` (line 84)
For invites without `instance_id` (the "client-paid" FlowEngine path), resend constructs a URL to `/invite/accept?token=...`. That page doesn't exist in OSS.
**Fix:** All OSS invites are access-grant style; always use `/invite/accept-access`.
**Status:** ✅ Fixed

### [ISSUE-09] OAuth callback only syncs profile email when `null`
**File:** `src/app/auth/callback/route.ts` (line 62)
`.is('email', null)` means only new-user profiles are updated. Email changes in the OAuth provider are never synced back.
**Fix:** Remove the `.is('email', null)` filter so the update always runs.
**Status:** ✅ Fixed

### [ISSUE-10] `profiles.tier` selected but doesn't exist in schema
**File:** `src/app/api/team/invite/route.ts` (line 41)
`select('tier, full_name')` — `tier` is not in the OSS `profiles` schema. Copied from FlowEngine subscription model; silently returns `undefined`.
**Fix:** Remove `tier` from the select.
**Status:** ✅ Fixed

### [ISSUE-11] Multi-agency re-invite guard is wrong for single-tenant OSS
**File:** `src/app/api/client/invite/route.ts` (lines 151–163)
Blocks inviting an email if another agency has a pending invite. In OSS (single agency), this creates confusing errors when an old invite is stuck in `pending`.
**Fix:** Remove the cross-agency check; keep only the self-duplicate check.
**Status:** ✅ Fixed

### [ISSUE-12] `first_run` detection fragile — profile trigger fires before signup completes
**File:** `src/app/api/auth-config/route.ts`
Counts profiles to determine first run. If the Supabase trigger creates a profile before the user completes email verification, `first_run` becomes permanently `false`.
**Fix:** Check `auth.users` count (via service role) rather than `profiles` count.
**Status:** 🔲 Backlog — profile count ≈ auth.users count in practice; only matters if trigger fires before email verification completes

---

## 🔵 Low / UX

### [ISSUE-13] `sessionStorage` pending invite lost on browser close
**Files:** `src/app/invite/accept-team/page.tsx`, `src/app/invite/accept-access/page.tsx`
Pending invite redirect stored in `sessionStorage` is cleared when the browser session ends.
**Fix:** Use `localStorage` with a short TTL (e.g. 1 hour) instead.
**Status:** ✅ Fixed

### [ISSUE-14] OAuth post-login redirects to `/` not `/portal`
**File:** `src/app/auth/callback/route.ts`
Default `next` is `/`. After OAuth the portal layout must intercept and redirect. Fragile if root doesn't redirect.
**Fix:** Default `next` to `/portal` so pending invite processing always fires.
**Status:** ✅ Fixed

### [ISSUE-15] Agency name on login page ignores `full_name`
**File:** `src/app/api/auth-config/route.ts`
Only uses `business_name`; if the owner only set `full_name`, the login page shows "FlowEngine".
**Fix:** Fall back to `full_name` when `business_name` is null.
**Status:** ✅ Fixed

### [ISSUE-16] No cancel or resend for pending team invites
**Files:** `src/app/api/team/members/` (missing routes)
Client invites have dedicated `/resend` and `[inviteId]/cancel` routes. Team invites have neither.
**Fix:** Add resend + cancel endpoints for team invites; expose in TeamMembers UI.
**Status:** 🔲 Backlog

---

## Legend
- ✅ Fixed — merged or applied
- 🔲 Backlog — acknowledged, not yet scheduled
- 🚧 In progress
