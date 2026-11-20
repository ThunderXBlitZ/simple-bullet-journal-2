# Changelog (append-only)

- M1 security: secret removed from local env/credential files, tokens moved out of persisted journal state into the IndexedDB `meta` store, `.env.example` added, `.env.local` untracked.
- M3 data model: single `bj-journal` IndexedDB key, per-record merge (`id` + `updatedAt`), `order`, tombstones, legacy-store migration, JSON export/import, cross-tab rehydrate.
- M6 Google sync: Google Identity Services token flow, per-record pull→merge→apply→push engine with version checks and retries, sync status/banner UI, first-link merge and account-switch replace-with-backup.
- M2 foundation: static export to `out/`, Pages `public/_headers` CSP, `components.json`, typecheck script, and removed Vercel analytics.
- M7 UX polish: tasks-only strike-through, 5-line clamp + expand (2-line in week), dnd-kit reorder for entries/habits/collections/items, drag entries across dates (`moveEntry`), month view shows all entry types + dated habits, `Habit.date`, `Collection.order` (persist v3), search over habits/collections/tags, random placeholders, compact settings + single Log out, more whitespace.
- M7 follow-ups: `moveEntry` now re-ids + tombstones (sync-safe), store split into `lib/store/*`, dated habits in daily view, Log out confirm (guest export prompt), search deep-links.
