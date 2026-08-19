# Horae — Production Runbook & Pre-Client Checklist

**Owner:** Faizal Hydrose (Project Lead) · **Team:** Bharani (Operator) · Ranjana (QC) · Suhas K S (Sponsor)
**Live app:** https://horae.cloud · **Repo (private):** `CodeRookie84/horae-cloud`
**Last updated:** 2026-08-11 — after the prototype→production security migration.

> This is your operations "runbook": what the system is, where everything lives, what to keep safe,
> what to do before onboarding clients, and how to recover when something breaks. It contains **no
> secret values** — only where they live. Keep the actual secrets in a password manager (see §3).

---

## 1. What Horae is (in one minute)

A multi-tenant SaaS operations platform. The data hierarchy — **do not "fix" it, it's correct by design:**

```
Client (a company, e.g. Cakewala — client_id h26cw01)
  └── Tenant (= an OUTLET, e.g. Cakewala-HO, Cakewala-1…)
        └── User (staff, assigned to one outlet)
```

The security boundary between companies is **client_id**. The app filters per-outlet by **tenant_id**.

**Stack:** React + Vite front-end (hosted on Vercel) → Supabase (Postgres database + Auth + Edge Functions).
There is no separate app server; the browser talks to Supabase directly, and **Row-Level Security (RLS)**
is what keeps each company's data private.

---

## 2. Where everything lives (infrastructure map)

| Piece | What / where | Notes |
|---|---|---|
| **Website hosting** | Vercel, connected to the GitHub repo | Auto-deploys on every push to `main` |
| **Domain** | `horae.cloud` (at your domain registrar) | SSL handled by Vercel |
| **Code** | GitHub `CodeRookie84/horae-cloud` (private) | Migration plans live as `Horae_*.md` in the repo |
| **Database + Auth** | Supabase project ref `vexqmdrldxhwrpcwbxow` (name "horae-ops", region ap-south-1) | Postgres, Auth, Edge Functions, Storage |
| **Edge Functions** | `notify-dispatcher`, `daily-digest`, `whatsapp-webhook`, `auth-admin`, `ai-draft` | Server-side logic with privileged keys |
| **Push notifications** | Browser Web Push via VAPID keys | No Firebase |
| **WhatsApp** | Meta WhatsApp Cloud API | Tokens stored as Supabase secrets |
| **AI (question drafting)** | Groq (primary) + Gemini (fallback) via the `ai-draft` function | Keys are server-side secrets |

**To redeploy the website:** push to `main` (or in Vercel, "Redeploy"). **To update an edge function:**
`supabase functions deploy <name> --project-ref vexqmdrldxhwrpcwbxow`.
**To run SQL on the database:** Supabase Dashboard → SQL Editor.

---

## 3. Break-glass kit — secrets & access to store safely

Store **all** of these in a password manager (Bitwarden / 1Password). **Never** in the code repo,
email, chat, or a plain text file on your computer. Record the *value* in the manager — this list is
only the inventory.

**Accounts & logins**
- [ ] Supabase account login **+ recovery/backup codes**
- [ ] Super-admin app login (`coderookie84@gmail.com` / DB email `admin@horae.ops`) **+ password** — this is the master key that can see every client; guard it like a bank login
- [ ] GitHub account (owner of `CodeRookie84/horae-cloud`)
- [ ] Vercel account (website hosting)
- [ ] Domain registrar login for `horae.cloud`
- [ ] Meta / WhatsApp Business account login

**Keys & tokens** (find under Supabase → Project Settings → API, and Edge Functions → Secrets)
- [ ] Supabase **project ref**: `vexqmdrldxhwrpcwbxow`
- [ ] Supabase **database password**
- [ ] Supabase **service_role key** (full admin — treat as top secret)
- [ ] Supabase **anon key** (public-facing, lower risk)
- [ ] **VAPID** public key **and** private key (push notifications)
- [ ] **Meta WhatsApp**: `META_WA_TOKEN`, phone-number ID, webhook verify token
- [ ] **Groq** API key + **Gemini** API key

**Archives**
- [ ] Team Talk archive ZIP (removed feature, kept for reference)

> **Golden rule:** the `service_role` key and the super-admin password can each unlock *everything*.
> If either ever leaks, rotate it immediately (Supabase → generate new key / reset password).

---

## 4. Pre-client checklist (before onboarding a paying client)

**Tier 1 — do before ANY paying client**
- [ ] **Backups on + tested.** Supabase → Database → Backups. Enable daily backups (paid plan adds point-in-time recovery). **Do one test restore** so you know it works. *This is the top gap right now.*
- [ ] **Super-admin account hardened** — strong unique password, stored in the password manager.
- [ ] **Full onboarding dry-run** — create a throwaway test client end-to-end (client → outlets → staff), confirm a staff member logs in and uses features, then delete it.
- [ ] **Terms of Service + Privacy Policy** published — you store staff personal data (names, phone numbers). Check `public/privacy.html` is real and complete; add terms.

**Tier 2 — soon after launch**
- [ ] **Staging environment** — a second Supabase project so future changes are tested off production (we worked on production this time only because the data was disposable).
- [ ] **Error monitoring** — so you find out about breakage before the client does.
- [ ] **Supabase Pro plan** — better backups, no project auto-pause, support. Worth it once a client pays.
- [ ] Confirm the **staff "forgot password"** story — today an admin resets it via the app (secure). Know that flow; consider self-service later.

---

## 5. What is already secured (verified 2026-08-11)

- ✅ **Real login** via Supabase Auth; passwords are one-way **hashed** (never readable by anyone).
- ✅ **Company isolation (RLS):** one client cannot see another's data — verified with real logins.
- ✅ **Public key exposes nothing:** with only the app's public key and no login, the database returns **0 rows**. (Before the migration, it returned everything.)
- ✅ **Privileged operations server-side:** admin password resets and new-staff logins run in an authorized server function using a key that never reaches the browser.
- ✅ **AI keys server-side:** Groq/Gemini keys are no longer in the browser bundle.
- ✅ Dead features removed (Growth Compass, Team Talk) and their tables dropped.

---

## 6. Ongoing operational rules (don't skip these)

1. **Every NEW database table must get RLS policies** the moment it's created — otherwise it is wide open to the public key, silently undoing the isolation. This is the single easiest way to reintroduce a leak.
2. **Test changes on staging first** (once it exists). Production has real client data now.
3. **Never paste the `service_role` key or DB password into the front-end, the repo, or chat.**
4. **Rotate a secret if it may have leaked** — Supabase makes this a few clicks; update the matching edge-function secret at the same time.
5. Keep this runbook updated when infrastructure changes.

---

## 7. Common admin tasks

- **Onboard a client:** log in as super admin → Horae Admin console → add the client, its outlets, then staff. Each staff member gets a temporary password to share; they set their own on first login.
- **Reset a staff password:** Client Admin → Staff Directory → Reset Password (runs through the secure server function; you can set a new one but can never *see* the old one).
- **Add a staff member:** Client Admin → onboard staff; the app creates their secure login and shows a one-time temporary password.
- **Change your own password:** the key icon by your account (staff/admin) or the "Change Password" button in the super-admin console.

---

## 8. Disaster recovery (when something goes wrong)

- **Bad data change / accidental delete:** restore from the most recent Supabase backup (Dashboard → Database → Backups → Restore). This is why Tier-1 backups matter.
- **Website down / bad deploy:** in Vercel, roll back to the previous deployment (Deployments → … → Rollback). The code is safe in GitHub.
- **A secret leaked:** rotate it in Supabase (or the relevant provider), then update the matching edge-function secret and redeploy.
- **Locked out of the app as super admin:** reset the password directly in Supabase → Authentication → Users (the account is `admin@horae.ops`).
- **Emergency: RLS change broke logins for everyone:** there is a rollback script at `supabase/migrations/20260811_rls_revert.sql` — run it in the SQL Editor to restore access while you diagnose (it removes isolation temporarily, so re-apply the real policies afterward).

---

## 9. Known residual items (not blocking, track for later)

- No separate **staging** environment yet.
- No automated **tests** — regressions rely on manual checking.
- Harmless **push/service-worker console warnings** in some browsers (do not affect data or features).
- Super-admin has a **blanket cross-client bypass** by design (needed for onboarding + the console) — this is why its password matters so much; consider adding MFA to that account later.
