# 00 — Design decisions (finish-up project)

## Spec

### Goal
Finish the bullet journal: close security holes, fix bugs, add missing features, restyle to a muted paper look, and ship real Google login + Drive sync. Local-first, hosted on Cloudflare Workers; Capacitor possible later (not in scope now).

### Decisions (from grilling, 2026-10-01)
| # | Topic | Decision |
|---|---|---|
| D1 | Auth | Client-only Google Identity Services token flow. No backend, **no client secret anywhere**. 1h access tokens, silent re-auth (`prompt:''`); on failure show a "Reconnect Google" banner — local data is never touched. |
| D2 | Hosting | Cloudflare Pages Git integration. Add `output: 'export'` so the build is reproducible and Capacitor-compatible. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set as a dashboard build variable. |
| D3 | Sync | Per-record auto-merge. Every record has `id` + `updatedAt`; deletes are tombstones (`deletedAt`, pruned after 90 days). Merge = newest `updatedAt` wins per record. No conflict modal. Single file `bullet-journal.json` in Drive `appDataFolder`, schema-versioned. |
| D4 | Profiles | One journal per device. Name is a setting. Google sign-in attaches sync to that journal. Remove guest-by-name lookup and the `bj-guest-*`/`bj-google-*` registry. |
| D5 | First link | Local journal + Drive data merge per-record (D3). |
| D6 | Account switch | Different Google account on a linked device => **replace** local with that account's data, after an automatic JSON backup download of the old local copy. |
| D7 | Secrets | Revoke/reset client secret in Google Cloud; `git rm --cached .env.local`; add `.env.example`; scrub `633206f` from the 10 unpushed local commits (user runs the commands; user commits manually). |
| D8 | Icons | `lucide-animated` (shadcn registry, `motion` dep, hover animation) with `lucide-react` fallback. Habit/collection icons become Lucide icon names; stored emoji auto-mapped on migration. |
| D9 | Month view | Cell = date + entry-count badge + up to 3 outlined tag rings; mobile shows count + rings only. Month summary strip: totals, task-done %, tag tabulation (outlined chip + count). Day popover lists first entries. |
| D10 | Extra scope | JSON export/import; tag filtering in views; rewrite stale `CLAUDE.md` + create `docs/STATE.md`/`ROADMAP.md`; fix `.gitignore` (`*.md` hides all docs). Out of scope: PWA, Capacitor itself. |

### Defaults I chose (veto any)
- Tokens (`accessToken`/`refreshToken`) leave the Zustand journal state; short-lived token lives only in the `meta` store (never synced, never exported).
- Sync triggers: app load, tab `visibilitychange`, manual button; push 5s debounced after a change; re-pull before push to avoid clobbering.
- IDs move from `Math.random` to `crypto.randomUUID()` (cross-device collision safety).
- Settings (zoom, focus mode, dots/lines) stay device-local; `userName` syncs as a record.
- Keep `StorageProvider` interface and add a thin `AuthProvider` interface so Capacitor can swap IndexedDB/auth later. Nothing Capacitor-specific is built now.
- Mood/gratitude were removed in the "revamp" commit (no store field; `mood-selector`/`mood-dropdown` are unused dead code, `--mood-*` tokens unused). M4 deletes the dead code; re-adding mood is out of scope. Dark theme kept.
- Palette: muted oklch — sage (complete), clay (event), dusty blue, ochre, plum. Exact values tuned in M4.
- Known risk (accepted with D1): GIS token flow won't work inside Capacitor WebViews; auth is redone behind `AuthProvider` when mobile starts.

### Findings that shape the work
- Storage is IndexedDB (not localStorage as docs say); whole store persists incl. tokens.
- Guest-name bug: root cause **not confirmed** from code reading. M3 step 1 reproduces it in-browser before changing anything; D4 then removes the code path.
- `components.json` absent => shadcn init needed before lucide-animated installs.
- Monthly view shows only the first *note* + 1px dots; no counts/tags.

### Non-goals
Backend/Worker code, Capacitor build, PWA/offline install, multi-profile UI.
