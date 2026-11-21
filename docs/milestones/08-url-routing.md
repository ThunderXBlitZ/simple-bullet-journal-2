# M8 — URL routing (back/forward + refresh)

## Spec
Goal: each view has its own URL so browser/Android back-forward and refresh keep your place. Deep links/sharing not a goal.
Constraint: static export now, Capacitor later → no host-side fallback/rewrites.
Decision: hash routing, one static page (`app/page.tsx` → `AppShell` → `RouteView`). Router is `lib/routes.ts` (`useRoute`, `navigate`, `parseRoute`).
Rejected: Next path routes + Cloudflare SPA fallback (breaks in Capacitor); `?id=` query routes (multi-file, slow `next dev` per-route compiles).

| URL | View |
|---|---|
| `/` (no hash) | daily, today |
| `/#/daily/YYYY-MM-DD` | daily log |
| `/#/weekly`, `/#/monthly`, `/#/habits`, `/#/collections` | as named |
| `/#/collections/<id>` | one collection (unknown id → list) |

Non-goals: per-modal URLs, scroll restoration.

## Verify (manual)
`npm run dev`: click through views, browser back/forward; refresh on `/#/daily/2026-01-05` and `/#/collections/<id>`; prev/next day then back; week/month day click opens that day; ⌘K navigation; `npm run build` succeeds.
