# State

Updated: 2026-11-19

- M1 security: done. Secret removed from local env/credential files and scrubbed from unpushed history; tokens live only in the IndexedDB `meta` store; `.env.example` added; `.env.local` untracked.
- M2 foundation: done. Static export (`out/`), Pages `_headers` CSP, `components.json`, repo hygiene.
- M3 data model: done. Single `bj-journal` key, mergeable records (`id`/`updatedAt`/`order`), tombstones, legacy migration, JSON export/import, cross-tab rehydrate.
- M6 Google sync: done. GIS token flow, per-record pull→merge→apply→push, status store, link/switch flows, sync UI + banner.
- M4 restyle: **not done** (dead mood code still present).
- M5 month hints + tag filtering: **not done**.

## Deploy checks
- Cloudflare Pages build variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must be set; build command `npm run build`, output directory `out`.
- Google Cloud: OAuth consent screen scopes `drive.appdata`, `userinfo.email`, `userinfo.profile`; authorized JS origins include localhost and the production URL; no client secret.
- Client secret was rotated by the user; old value scrubbed from unpushed history.
