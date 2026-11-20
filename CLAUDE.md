# Bullet Journal

Local-first bullet journal (Next.js 16 static export, React 19, Zustand, Tailwind 4). Hosted on Cloudflare Workers
(static assets). Data lives in IndexedDB; optional sync to Google Drive appDataFolder. Capacitor may come later.

## Rules
- Client-only: no API routes, no server secrets. Only `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (see `.env.example`).
- Never commit secrets or `.env*` (except `.env.example`).
- No block fills for status/tag/mood color: colored **outlines** on muted paper tokens; icons via `components/icons` (lucide-animated) or lucide-react.
- Sync is per-record merge (`id` + `updatedAt`, deletions in `tombstones`). Never overwrite whole-journal snapshots.
- Source files ≤400 lines soft cap, 600 hard.
- Design + decisions: `docs/milestones/00-design-decisions.md`. State: `docs/STATE.md`. Plan: `docs/ROADMAP.md`.

## File map
- `app/page.tsx` — bootstrap, view switching.  `app/globals.css` — theme tokens.
- `lib/journal-store.ts` — Zustand store + persist.  `lib/types.ts` — data types.
- `lib/journal-data.ts` / `lib/journal-helpers.ts` — syncable subset + pure helpers.  `lib/schema.ts` — zod schema (backup + remote).
- `lib/sync/` — merge, remote format, status, engine, link.
- `lib/storage/` — IndexedDB provider, Zustand adapter, cross-tab, legacy migration.
- `lib/google/` — GIS auth + Drive transport.  `lib/auth/` — AuthProvider interface.
- `lib/backup.ts` — JSON export/import.  `scripts/` — verification scripts.
- `components/icons/` — lucide-animated (generated; use via `journal-icon.tsx` for habit/collection icons).
- `components/journal/` — feature views/modals.  `components/ui/` — shadcn primitives.
