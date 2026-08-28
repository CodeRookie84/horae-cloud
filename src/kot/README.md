# KOT — Cake-Order Tracking (isolated module)

A self-contained feature built inside Horae for **Cakewala**, deliberately walled
off so it can be lifted out into a standalone app with minimal surgery.

## Isolation contract

- **All KOT code lives under `src/kot/`.** Nothing outside this folder imports
  from it except the handful of mount points listed below.
- **We do not restyle or change any existing Horae component.** Anything shared
  is *duplicated* into `src/kot/` (see `src/kot/ui/`), never imported from
  `src/components/`. The one exception is the low-level Supabase client, which is
  infrastructure, not design — and even that is funnelled through
  `src/kot/lib/supabase.ts` so swapping to a standalone client later is a
  one-file change.
- **Database:** every table is prefixed `kot_` (migration
  `supabase/migrations/20260828_kot.sql`). No existing table is altered. Outlets
  reuse Horae's `tenants`; the manager⇄KOT link lives on
  `kot_participants.linked_user_id`, so `users` is untouched.
- **Backend:** its own edge functions (`kot-station-auth`, `kot-extract`,
  `kot-notify`, `kot-reminders`) and its own storage bucket `kot-photos`.
  `notify-dispatcher` / `daily-digest` are never modified — the KOT notification
  lane is fully separate.

## Core touchpoints (grep `[KOT]` to find every one)

Removing KOT = delete `src/kot/`, delete the `kot-*` edge functions, drop the
`kot_*` tables + bucket, and delete these clearly-marked lines:

1. `src/App.tsx` — a `/kot` kiosk short-circuit near the top, and one
   `activeTab === "kot"` render block.
2. The launcher tile — one guarded line for the manager-facing icon.

Each is tagged with a `// [KOT]` comment. There are no other hooks.
