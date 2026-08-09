# Horae — Security Migration Plan (Staging + Auth + RLS)

**Owner:** Faizal Hydrose · **Drafted:** 2026-08-10 · **Status:** proposal, not yet executed
**Scope:** the three coupled workstreams that turn Horae from a prototype into something safe to sell to a second paying client — **Staging**, **Real Auth**, and **Real RLS**. These are one project, not three; the ordering below is load-bearing.

> This supersedes the auth/RLS sketch in `Horae_HANDOFF_BRIEF.md` where they conflict. The brief's *principle* is right (isolation boundary = `client_id`). Its *plan* underestimates the work, because the schema does not actually carry `client_id` on the tables that need protecting. See §2.

---

## 0. The one finding that reframes everything

Horae has **no server tier for app data.** The browser holds the Supabase **anon key** (it's in the JS bundle) and calls PostgREST directly for every read and write. Every RLS policy is `USING (true)` / `WITH CHECK (true)` — including `tmp_delete` (the "DELETE tourniquet" from the brief was reverted by `20260718_delete_policies.sql`).

**Net effect:** anyone who opens devtools, copies the anon key, and hits the REST API can read, modify, and delete *every row of every customer's data*. The login screen is cosmetic — it's a plaintext-password comparison in JavaScript, so bypassing the UI bypasses "auth" entirely.

Auth and RLS are therefore **not hardening. They are the security model, and it does not exist yet.** Everything else (more features, more clients) increases the blast radius until this is fixed.

---

## 1. Current infra reality (verified 2026-08-10)

| Fact | Detail | Consequence for this plan |
|---|---|---|
| **One Supabase project** | `vexqmdrldxhwrpcwbxow` (horae-ops, ap-south-1) | No staging. Must build it before any risky step. |
| **Schema applied by hand** | `supabase migration list --linked` shows **no remote rows** | **Never `supabase db push`** — it would replay all migrations onto a schema that was built by hand and collide. |
| **Frontend** | Vercel, auto-deploys on push to `main` | Need a preview/branch env so staging frontend ≠ prod. |
| **CLI** | logged in + linked | `supabase db query --linked "…"` runs SQL against prod via the Management API (no DB password needed). Good for verification. |
| **AI keys in bundle** | `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY` | Extractable from client JS. Proxy through an edge function during Stage 3 cleanup. |

---

## 2. Schema reality — the three tiers (this is the crux)

The brief says "filter on `client_id`." You **can't**, directly, on most tables — the column isn't there. Every table falls into one of three tiers, and each tier needs a *different* policy shape.

### Tier A — has `client_id` (direct policy) — 5 tables
`tenants`, `chat_channels`, `trainings`, `maintenance_sop_meta`, `swot_analyses`*
Plus `clients` itself (boundary is its own `id`).
→ Policy: `client_id = app.current_client_id()`.
\* `swot_analyses` is dead post-Growth-Compass removal; drop it instead of writing a policy (see §7).

### Tier B — only `tenant_id` (resolve through `tenants`) — ~17 tables
`checklists`, `notices`, `tasks`, `notifications`, `users`, `training_attempts`, `chat_messages`, `chat_spaces`, `chat_mentions`, `maintenance_audits`, `maintenance_checklist_history`, `maintenance_checklist_state`, `maintenance_defects`, `maintenance_equipment`, `digest_tracker`, `whatsapp_inbound_messages`, (`notification_log` stays service-role only).
→ Policy: `tenant_id IN (SELECT id FROM tenants WHERE client_id = app.current_client_id())`.

### Tier C — neither `client_id` nor `tenant_id` (resolve through a parent FK) — 8 tables
| Child table | Link column | Parent | Parent's boundary |
|---|---|---|---|
| `checklist_items` | `checklist_id` | `checklists` | tenant_id (Tier B) |
| `task_messages` | `task_id` | `tasks` | tenant_id (Tier B) |
| `chat_members` | `channel_id` | `chat_channels` | client_id (Tier A) |
| `chat_channel_auto_rules` | `channel_id` | `chat_channels` | client_id (Tier A) |
| `chat_read_receipts` | `message_id` | `chat_messages` | tenant_id (Tier B) |
| `chat_priority_users` | `user_id` | `users` | tenant_id (Tier B) |
| `notification_claims` | `user_id` | `users` | tenant_id (Tier B) |
| `chat_thread_participants` | `thread_id` | **confirm FK** | — |

→ Policy: `EXISTS (SELECT 1 FROM <parent> p WHERE p.<pk> = <child>.<link> AND <parent boundary predicate>)`.

**Action item before Stage 3:** confirm `chat_thread_participants.thread_id`'s real parent (likely `chat_messages` or a threads table), and decide whether any Tier-C tables should just get a `tenant_id`/`client_id` column added (denormalize) to avoid a subquery. For the largest / hottest tables (`task_messages`, `checklist_items`) I recommend **adding `tenant_id`** and backfilling — cheaper at query time than an `EXISTS` on every row.

---

## 3. Stage 0 — Staging environment (do this first, always)

**Goal:** a second Supabase project + a non-prod frontend, so every step in §4–§7 is rehearsed before it touches the live DB. You have one production database and no undo.

1. **Create `horae-staging`** Supabase project (same region, ap-south-1).
2. **Clone the schema** — because prod's migration history is empty, do **not** rely on `db push`. Instead:
   - `supabase db dump --linked -f schema_dump_prod.sql` (schema only, `--schema public`), or use the existing `supabase/schema_dump.sql` if current, and apply it to staging via the SQL editor / `psql`.
   - **Verify parity:** diff `information_schema.columns` between the two projects. They must match before proceeding.
3. **Seed synthetic data** — 2 fake clients (e.g. `TEST-A`, `TEST-B`), each with 2 outlets and a few staff. **Do not copy real Cakewala data** (it contains real staff PII + the plaintext passwords). Synthetic data is also what makes the cross-client isolation test (§6) meaningful.
4. **Frontend:** a Vercel preview deployment (or a `staging` branch) with its own `.env` pointing at `horae-staging`'s URL + anon key.
5. **Adopt migrations going forward:** from now on, *every* schema change is a numbered file in `supabase/migrations/` applied to **staging first, then prod**, by hand via the SQL editor (keep the by-hand discipline; just make it ordered and reviewed). Optionally run `supabase migration repair` to baseline prod's history so future tooling behaves — but that's a nice-to-have, not a blocker.

**Exit criteria:** staging schema == prod schema; synthetic clients seeded; staging frontend loads against staging DB.

---

## 4. Stage 1 — Real authentication (Supabase Auth)

**Goal:** replace the `avatar#pwd=` plaintext scheme + localStorage identity with `auth.users` and one-way password hashes. The hard part is **not** login — it's that identity currently lives in localStorage (`horae_active_user_id`, `_client_id`, `_tenant_id`) and the super-admin password is hardcoded in `store.ts`.

### 4.1 Link the existing `users` table to auth
`public.users` has no `auth_id` today. Add one:
```sql
ALTER TABLE public.users ADD COLUMN auth_id uuid UNIQUE REFERENCES auth.users(id);
```

### 4.2 Provision auth accounts (one-time migration script, run in staging first)
For each `public.users` row:
- Create an `auth.users` entry via the Admin API (service role, from a Node/edge script — never the browser) using the user's login key (email, or phone-as-email shim `<phone>@horae.local` for phone-only staff — see `loginKeyFor`).
- Set a temporary password = their *current* plaintext password (from `avatar#pwd=`), so nothing breaks on first login.
- Write the new `auth.users.id` back to `public.users.auth_id`.
- Force `pwd_changed = false` so the existing mandatory first-login reset flow makes them set a real password (which Supabase then stores hashed — you can never read it again).

### 4.3 Swap the login path
- `store.login()` / `authService` → `supabase.auth.signInWithPassword({ email: loginKeyFor(id), password })`.
- Delete `getStaffPasswords`, `saveStaffPassword`, all `#pwd=` read/write logic, and the hardcoded `!Horae@2026`.
- Password **reset** (admin-initiated) → `supabase.auth.admin.updateUserById` from a server-side edge function. Admin can reset, never see.

### 4.4 Kill localStorage-as-truth
Identity, active client, active tenant, and role must be **derived from the session**, not read from localStorage:
- On auth state change, fetch the caller's `public.users` row by `auth_id = auth.uid()`, and derive `client_id` (via `tenant_id → tenants.client_id`), `tenant_id`, and `role` from it.
- localStorage may remain a *cache* for offline/optimistic UX, but the DB row is authoritative and always wins on refresh. This directly fixes the "super-admin password won't change" and "UI/DB disagree" bugs in the brief.

**Exit criteria (staging):** every seeded user can log in with Supabase Auth; first login forces a password change; no plaintext password is readable anywhere; admin can reset but not view.

---

## 5. Stage 2 — Identity resolution for RLS

RLS policies need a fast, trustworthy answer to *"what client is the caller?"* Build this **between** auth and the policy rollout.

### 5.1 A SECURITY DEFINER resolver
```sql
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_client_id()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.client_id
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.auth_id = auth.uid()
  LIMIT 1
$$;
```
`STABLE` lets Postgres cache it per statement. Add a matching `app.is_super_admin()` (role = 'Super Admin') for the platform-owner escape hatch.

### 5.2 (Recommended) inline the claim via a custom access-token hook
Resolving through `users → tenants` on every row is fine at Cakewala's scale but not free. Supabase's **custom access token auth hook** can stamp `client_id` (and `role`) into the JWT `app_metadata` at login. Policies then read `auth.jwt() -> 'app_metadata' ->> 'client_id'` with zero subquery. Do the function first (correctness), add the hook later (performance) — both can coexist, function as the fallback.

**Exit criteria:** `SELECT app.current_client_id()` returns the right client for each seeded auth session, and NULL for an anonymous/service context.

---

## 6. Stage 3 — RLS conversion (the payoff)

Now — and only now, because it depends on §4–§5 — replace the `tmp_*` `USING(true)` policies **table by table**, tier by tier. Do it in staging, run the isolation test after *each* table, then replay the exact SQL on prod.

### 6.1 Policy templates

**Tier A (has `client_id`):**
```sql
DROP POLICY IF EXISTS tmp_select ON public.trainings;
DROP POLICY IF EXISTS tmp_insert ON public.trainings;
DROP POLICY IF EXISTS tmp_update ON public.trainings;
DROP POLICY IF EXISTS tmp_delete ON public.trainings;

CREATE POLICY client_rw ON public.trainings
  USING (client_id = app.current_client_id())
  WITH CHECK (client_id = app.current_client_id());
```
(`clients` special case: `USING (id = app.current_client_id())`.)

**Tier B (only `tenant_id`):**
```sql
CREATE POLICY tenant_rw ON public.checklists
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE client_id = app.current_client_id()));
```

**Tier C (via parent FK):**
```sql
CREATE POLICY parent_rw ON public.checklist_items
  USING (EXISTS (
    SELECT 1 FROM public.checklists c
    JOIN public.tenants t ON t.id = c.tenant_id
    WHERE c.id = checklist_items.checklist_id
      AND t.client_id = app.current_client_id()))
  WITH CHECK (EXISTS ( … same … ));
```

### 6.2 Order of attack
1. Start with **`tenants` and `clients`** (Tier A) — everything else resolves through them.
2. Then Tier B core: `users`, `checklists`, `notices`, `tasks`, `notifications`, `training_attempts`, `maintenance_*`.
3. Then Tier C children.
4. `notification_log`, `digest_tracker` — leave **service-role only** (no anon policy at all).
5. Add a **super-admin bypass** where the platform owner genuinely needs cross-client reach (onboarding, support): `OR app.is_super_admin()`.

### 6.3 The isolation test (run after every table)
Seeded `TEST-A` user must get **zero** rows of `TEST-B` data, and vice-versa:
```sql
-- as an authenticated TEST-A session:
SELECT count(*) FROM checklists;                    -- only TEST-A's
SELECT count(*) FROM checklists
  WHERE tenant_id IN (SELECT id FROM tenants WHERE client_id = 'TEST-B'); -- must be 0
```
Also test the **write** direction: a TEST-A session attempting `INSERT`/`UPDATE`/`DELETE` of a TEST-B row must fail. This write test is what the current `USING(true)` world silently allows.

**Exit criteria:** cross-client read AND write both return 0 rows / are rejected, on every table, in staging — then the same SQL is replayed on prod.

---

## 7. Stage 4 — Server-side privileged ops + cleanup

Once RLS holds, remove the remaining anon powers:
- **Deletes, staff provisioning, plan changes, password resets** → edge functions using the service role, called by an authenticated (and authorized) user. You already have the edge-function pattern (`notify-dispatcher` etc.), so this is extension, not invention. Then **drop the anon `tmp_delete` policies** entirely.
- **Proxy AI keys:** move Groq/Gemini calls behind an edge function; remove `VITE_GROQ_API_KEY` / `VITE_GEMINI_API_KEY` from the client bundle.
- **Drop `swot_analyses`** (Growth Compass was removed 2026-08-10): `DROP TABLE IF EXISTS public.swot_analyses;` — staging first.

---

## 8. Sequencing & go/no-go

```
Stage 0  Staging            ──────────────►  (blocks everything)
Stage 1  Auth (staging)     ─────►  verify  ─────►  Auth (prod)
Stage 2  Resolver fn        ─────►  verify
Stage 3  RLS table-by-table ─────►  isolation test each table  ─────►  replay on prod
Stage 4  Server-side ops + key proxy + drop swot_analyses
────────────────────────────────────────────────────────────────
(parallel, safe) Subscription-tier UI on top of plans.ts — no auth/RLS coupling
```

**Rollback:** every RLS change is a pair of SQL scripts (`apply.sql` / `revert.sql`, the latter re-creating `USING(true)`). Auth rollback = keep the old login path behind a feature flag until a full cohort has logged in successfully on the new one. Never run a stage against prod that hasn't passed its exit criteria in staging.

**Do NOT** start the AI / Team-Talk work until Stages 1–3 are done on prod. The subscription-tier UI is the one thing safe to build in parallel, because `plans.ts` already derives entitlements server-side.

---

## 9. Open questions to resolve before Stage 3

1. `chat_thread_participants.thread_id` — what's its parent table/PK? (Needed for its Tier-C policy.)
2. For `task_messages` and `checklist_items` (hot child tables): denormalize a `tenant_id` column + backfill, or accept the `EXISTS` subquery? (Recommend denormalize.)
3. Phone-only staff auth: confirm the `loginKeyFor` shim (`<phone>@horae.local`) is acceptable, or enable Supabase phone auth.
4. Super-admin reach: which tables does the platform owner legitimately need cross-client access to, vs. must go through an audited edge function?
