#!/bin/bash
# Autonomous bug-fix loop for FlowEngine OSS portal
# Agents in .claude/agents/ are used as subagents automatically
# Press Ctrl+C to stop

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "Starting autonomous bug-fix loop..."
echo "Working directory: $PROJECT_DIR"
echo "Press Ctrl+C to stop."
echo ""

claude "You are the coordinator for an autonomous bug-fix loop on the FlowEngine OSS portal (Next.js 15 + Supabase + TypeScript).

## HARD CONSTRAINT — SCOPE LOCK
You MUST only read and modify files inside: $PROJECT_DIR
NEVER cd into, read, or modify any other directory (e.g. ~/FlowEngine or any path outside this project).
Every Bash command must stay within $PROJECT_DIR. If a command would navigate outside it, skip it.

## Broken flows to fix (priority order)
1. Inviting team members
2. Team member management (remove / change role)
3. Assigning instances to clients
4. Adding / deploying new instances

## Key files per flow
- Team invites: src/app/api/team/invite/route.ts, src/components/settings/TeamMembers.tsx, src/lib/teamUtils.ts
- Team member mgmt: src/app/api/team/members/[id]/route.ts, src/lib/validation.ts
- Assigning instances: src/app/api/client/invite/route.ts, src/app/api/agency/clients/route.ts, src/app/portal/clients/context.tsx, src/lib/teamAccess.ts
- New instances: src/app/portal/hosting/context.tsx, src/components/DeployInstanceModal.tsx, src/lib/flowengine.ts

## Environment
- Demo at demo.flowengine.cloud (self-hosted Supabase). Service role key in .env as SERVICE_ROLE_KEY — never commit.
- Schema source of truth: migrations/supabase-schema.sql (idempotent). DDL via db-migrate only.
- portal_settings is singleton: always ORDER BY updated_at DESC LIMIT 1 .maybeSingle()
- Use Supabase JS client in routes, never raw SQL

## Loop — run exactly 12 cycles then stop:
### Each cycle:
1. Run git log --oneline -10 to see what has already been fixed
2. Read relevant files for the next unfixed bug. Pick ONE specific bug.
3. Spawn bug-fixer subagent with: which flow, the symptom, which files, suspected root cause
4. After fix: spawn bug-reviewer subagent to review the diff
5. If reviewer says PASS → git add -A && git commit -m 'fix: [description]'
   If reviewer says FAIL → re-brief bug-fixer with reviewer feedback, retry max 2x, then skip
6. Print: [Cycle N/12] FIXED: <what> | NEXT: <what>
7. After 12 cycles, print a summary of all fixes and stop.

## Rules
- Never ask for input — decide everything autonomously
- One focused bug per cycle
- Never commit .env or secrets
- Schema/migration changes: flag them but do not touch supabase-schema.sql

Start now. Run the loop." \
  --allowedTools "Read,Write,Edit,Bash,Glob,Grep"
