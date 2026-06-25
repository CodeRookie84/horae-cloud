# Horae — Operations, Simplified

Multi-tenant SaaS operational platform for bakery & confectionery management — built for Bhatta's Foods (Cakewala and Eshanya Hotels). Covers granular workspace administration, department- and role-based notices, checklist systems, quizzes, Team Talk, and collaborative task management.

## Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS v4 (theme tokens via `@theme` in `src/index.css`)
- Motion (Framer Motion successor) for animations
- Supabase (auth, Postgres, edge functions, web push)
- Lucide React for icons

## Run locally

Prerequisites: Node.js 20+

```bash
npm install
cp .env.example .env.local       # fill in your Supabase + VAPID keys
npm run dev
```

App runs at `http://localhost:3000`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the built bundle |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run clean` | Remove `dist/` and built server |

## Design system — "Patisserie Modern"

The UI is grounded in real bakery materials rather than another generic SaaS theme. Core tokens are defined in `src/index.css` under `@theme`:

| Token | Hex | Used for |
|-------|-----|----------|
| `--color-brand` | `#6FC3CC` | Light cyan — primary actions, key headers |
| `--color-accent` | `#D4946A` | Caramel — accents, highlights |
| `--color-cream` | `#FBF6EE` | Page background |
| `--color-ink` | `#2E2530` | Primary text |
| `--color-sage` | `#9BB89F` | Positive state |
| `--color-rose` | `#E3B5BC` | Urgent / warning highlights |

Typography pairs **Fraunces** (warm serif, display) with **Inter** (body). The dashboard hero card carries a subtle "piped dots" SVG watermark as the single decorative moment — every other surface stays quiet.

Legacy brand hexes (`#162D4E`, `#C5A880`) are still safe to use throughout the codebase; CSS override rules in `index.css` map them to the new palette automatically, so refactoring each component is not required.

## Project structure

```
src/
  App.tsx                  Root router & state
  index.css                Tailwind v4 theme + brand overrides
  components/              All UI panels (Dashboard, Sidebar, TeamTalk, …)
  services/
    supabaseClient.ts      Supabase client
    chatService.ts         Team Talk
    store.ts               App state helpers
    fcmService.ts          Web push (VAPID)
  types.ts                 Domain types: Tenant, User, Notice, Task, …
public/
  manifest.json            PWA manifest
  sw.js                    Service worker (push + offline shell)
supabase/
  migrations/              SQL migrations
  functions/               Edge functions (daily-digest, notify-dispatcher)
```

## Environment variables

See `.env.example` for the full list. Public keys live in the frontend (`VITE_*`); private keys (`VAPID_PRIVATE_KEY`, `META_WHATSAPP_TOKEN`, etc.) belong in **Supabase Dashboard → Settings → Vault**, never in this repo.

## Contributors

- **Project Lead** — Faizal Hydrose
- **Project Operator** — Bharani
- **QC Lead** — Ranjana
- **Sponsor** — Suhas K S

## License

Apache-2.0
