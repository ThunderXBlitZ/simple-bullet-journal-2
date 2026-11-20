# State

Updated: 2026-11-20

- M1, M2, M3, M6: done (security, static export, data model, Google sync).
- M7 UX polish: implemented, **not manually verified** (see `docs/milestones/07-ux-polish.md`). Persist version 3.
- M4 restyle: **not done** (dead mood code still present).
- M5 month hints + tag filtering: **not done** (month view now shows all entry types; summary strip/tag rings pending).

## Known follow-ups
- None open. M7 still needs manual verification (see `docs/milestones/07-ux-polish.md`).

## Deploy checks
- Cloudflare build variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set; build `npm run build`, output `out`.
- Google Cloud: scopes `drive.appdata`, `userinfo.email`, `userinfo.profile`; authorized JS origins include localhost + production; no client secret.
