# M8 — URL routing (back/forward + refresh)

## Spec
Goal: each view has its own URL so browser/Android back-forward and refresh keep your place. Deep links/sharing not a goal.
Constraint: static export now, Capacitor later → every URL must be a real pre-rendered file; no host-side fallback/rewrites.
Decision (Approach B): clean paths for static views; query params for the two dynamic ones.
Rejected: path params `/collections/<id>` + Cloudflare SPA fallback (breaks in Capacitor: fallback serves root index.html).

| URL | View |
|---|---|
| `/` | redirects to `/daily` |
| `/daily?date=YYYY-MM-DD` | daily log (no param = today) |
| `/weekly`, `/monthly`, `/habits`, `/collections` | as named |
| `/collections/view?id=<id>` | one collection |

`next.config.ts`: `trailingSlash: true` (predictable `x/index.html` layout for Capacitor).
Non-goals: per-modal URLs, scroll restoration.

## Plan
1. `lib/routes.ts`: `View` type, `routes` builders, `viewFromPath(pathname)`.
2. `components/journal/app-shell.tsx`: bootstrap + sidebar/nav/palette/settings moved out of `app/page.tsx`; renders `children` inside `<Suspense>`; wrap in `app/layout.tsx`.
3. Pages: `app/{page,daily,weekly,monthly,habits,collections,collections/view}/page.tsx`.
4. `DailyLog` controlled by `date` + `onDateChange` (URL-driven); `CollectionsView` list-only, click pushes URL.
5. Sidebar/MobileNav keep props; shell derives `currentView` from pathname and pushes routes.

## Verify (manual)
`npm run dev`: click through views, use browser back/forward; refresh on `/daily?date=2026-01-05` and `/collections/view?id=…`; prev/next day then back; week/month day click opens that day; ⌘K navigation; `npm run build` succeeds.
