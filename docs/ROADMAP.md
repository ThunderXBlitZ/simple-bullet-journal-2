# Roadmap

Decisions: `docs/milestones/00-design-decisions.md`. Detail per milestone in `docs/milestones/<id>-<slug>.md` (plan + verify steps).

| ID | Milestone | Depends on |
|---|---|---|
| M1 | Security: revoke secret, untrack `.env.local`, scrub history, tokens out of journal state | — |
| M2 | Foundation: docs/.gitignore fix, static export + Cloudflare Pages, shadcn init | M1 |
| M3 | Data model: reproduce name bug, JSON export/import, one-journal migration, `updatedAt`/tombstones, UUID ids (Drive sync disabled until M6) | M2 |
| M6 | Google login + Drive per-record sync, account-switch replace | M3 |
| M4 | UI restyle: muted tokens, outlines instead of fills, lucide-animated | M2 (M6 preferred first) |
| M5 | Monthly hints + tag filtering | M4 |
| M8 | URL routing: per-view routes, back/forward + refresh (`milestones/08-url-routing.md`) | M2 |

Order: M1 -> M2 -> M3 -> M6 -> M4 -> M5. Ship M1 alone first. **Do not deploy between M3 and M6** (sync is off in between); M4/M5 are safe to deploy individually.
