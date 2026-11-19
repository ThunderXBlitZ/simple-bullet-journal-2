# Features & Test Guide

Updated: 2026-11-19. Scope of this pass: **M1 security + M3 data model + M6 Google login/Drive sync**.
M2 (static export/Workers), M4 (restyle) and M5 (month hints/tag filter) are **not** implemented yet.

---

## 1. Feature overview

### Journal (local-first)
- **Daily log**: tasks, events, notes with bullet notation; status cycling
  (open → complete → migrated → scheduled → irrelevant); inline edit; indent 0–3;
  drag reorder; migrate incomplete tasks to another day.
- **Tags**: preset tags plus custom tags; attach/remove on entries.
- **Habits**: create/delete, icon+color, monthly completion grid, streaks, percentages, reorder.
- **Collections**: custom lists with checkboxes, progress, reorder, delete.
- **Views**: Daily, Weekly, Monthly, Habits, Collections; command palette (Cmd/Ctrl+K);
  focus mode; light/dark themes; dots/lines; zoom.
- **Persistence**: single IndexedDB key `bj-journal` (version 2). Legacy keys
  (`bullet-journal-storage`, `bj-guest-*`, `bj-google-*`) are migrated once and left untouched.
- **Cross-tab**: edits in one tab rehydrate the other via `BroadcastChannel`.
- **Backup**: Settings → Backup → Export JSON / Import JSON (merge).

### Data model (mergeable)
- Every record has `id`, `createdAt`, `updatedAt`, and (where ordered) `order`.
- Deletes are **tombstones** (`tombstones: { id: deletedAt }`, 90-day TTL), so deletes propagate.
- Merge rule: newest `updatedAt` wins per record; edit-after-delete resurrects; tags with the same
  name collapse and entries are remapped; habit completions for deleted habits are dropped.
- Preset tags use deterministic ids so two fresh devices merge without duplicates.

### Google login + Drive sync
- Client-only Google Identity Services token flow. Scopes: `userinfo.profile`, `userinfo.email`,
  `drive.appdata`. **No client secret.**
- Tokens live only in the IndexedDB `meta` store (`googleAuth/accessToken`, `googleAuth/tokenExpiry`),
  never in journal state and never exported.
- One file `bullet-journal.json` in Drive **appDataFolder**. Legacy `bullet-journal-backup.json`
  is read once as a fallback and never modified.
- Engine: pull → merge → apply (re-merged against current local) → push with a `version` check;
  retries with exponential backoff; 401 triggers a silent refresh.
- Triggers: 5s debounce after a change, app load, tab refocus (≤ every 30s), `online`, manual Sync now.
- Statuses: `Synced <time>` / `Syncing…` / `Paused — reconnect to resume.` / error message + top banner.
- First link merges. Signing in as a **different** account replaces local after downloading a backup.
- Sign out keeps the link; reconnect refuses a different account.

---

## 2. Prerequisites (one-time)

1. **Google Cloud project**
   - Enable the **Google Drive API**.
   - OAuth consent screen: add scopes `…/auth/drive.appdata`, `…/auth/userinfo.email`,
     `…/auth/userinfo.profile`. (`drive.appdata` is non-sensitive; no verification needed.)
   - OAuth client (Web application): authorized JavaScript origins must include
     `http://localhost:3000` and the production URL. **Delete any client secret** — it is unused.
   - If the consent screen is in Testing, add your Google account as a test user.
2. **Local env**: `.env.local` with only `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<id>` (see `.env.example`).
   Restart `npm run dev` after editing.
3. **Install deps**: `npm install`.

---

## 3. Automated checks

```bash
npx tsc --noEmit                 # must be clean
npm run build                    # must succeed
npx tsx scripts/verify-merge.ts  # 9 PASS lines, no FAIL (downloads tsx on first run)
```

---

## 4. Manual test plan (two browser profiles A and B, same Google account)

> Profile A = your normal Chrome profile. Profile B = a fresh/incognito profile (or another browser).
> DevTools → Network, filter `googleapis`, is used throughout.

### 4.1 First run & migration
- [ ] `npm run dev`, open `http://localhost:3000`.
- [ ] If old data exists: journal opens **without** a name prompt; entries/habits/collections present.
- [ ] DevTools → Application → IndexedDB: `data` has `bj-journal` plus untouched legacy keys; `meta.schema` = `2`.
- [ ] Clear site data → name dialog shows once; reload → it does not return.

### 4.2 Sign in & link (A)
- [ ] Settings → Google Drive → **Sign in with Google** → consent, **tick Drive**.
- [ ] Status shows `Synced …`. No console errors.
- [ ] Verify the file (copy a bearer token from a `googleapis` request):
  ```bash
  curl -H "Authorization: Bearer <token>" \
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)"
  ```
  Expect `bullet-journal.json`.

### 4.3 Restore on B
- [ ] Fresh profile → **Restore from Google Drive** → name + entries appear.
- [ ] B's status shows `Synced …`.

### 4.4 Propagation
- [ ] Add an entry in A → within ~35s (or focus B) it appears in B.
- [ ] Delete it in A → disappears in B.
- [ ] Edit the same entry in both while B is offline (DevTools → Offline) → reconnect → newest edit wins in both, nothing else lost.
- [ ] Delete a tag in A → gone in B, entries intact.

### 4.5 In-flight edit
- [ ] DevTools → Network throttle "Slow 3G"; type entries while a sync runs → after completion all typed
  entries exist locally and reach Drive on the next sync.

### 4.6 No sync loop
- [ ] A signed in and idle: Network filter `googleapis` for 90s → no requests except focus/online/edits.
- [ ] Two tabs of A open: still none.

### 4.7 Token expiry
- [ ] DevTools → Application → IndexedDB → `meta` → set `googleAuth/tokenExpiry` to `0`, reload →
  either silent resume, or the banner appears → **Reconnect** → `Synced`. Local data untouched.

### 4.8 Revoked access
- [ ] Revoke at myaccount.google.com/permissions → **Sync now** → banner/Reconnect → consent returns.

### 4.9 Wrong account on reconnect
- [ ] With an expired token, click **Reconnect** and pick a *different* Google account → error toast,
  nothing synced to that account.

### 4.10 Account switch (D6)
- [ ] Sign out, then **Sign in with Google** as another account → a backup JSON downloads; journal becomes
  that account's data (empty if new); previous account's Drive untouched. Re-import the backup to confirm.

### 4.11 Legacy Drive snapshot
- [ ] If `bullet-journal-backup.json` exists on Drive, sign in on a fresh profile → data appears;
  a new `bullet-journal.json` is created; the legacy file is still present.

### 4.12 Granular consent
- [ ] On consent, untick Drive → error toast "Google Drive access wasn't granted…"; nothing linked.

### 4.13 Offline
- [ ] Reload while offline → app works, status shows offline error; back online → syncs.

### 4.14 Corrupt remote (optional, dev only)
- [ ] Overwrite the Drive file body with `{}` → status error "can't be read"; local data and Drive file unchanged.

### 4.15 Local data integrity
- [ ] Delete an entry, reorder two entries; inspect `bj-journal`: `tombstones` has the id; moved entries
  have new `order`/`updatedAt`; new records have UUID ids.
- [ ] Export JSON → delete an entry → Import the file → entry stays deleted (tombstone beats older copy).
- [ ] Import `package.json` → toast error, nothing changes.

### 4.16 Production (after M2 lands)
- [ ] Set the Cloudflare build variable `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; deploy.
- [ ] Repeat sign-in + one propagation test on the production URL; console has no CSP violations.

---

## 5. Security follow-ups (do before pushing)

- [ ] Rotate/delete the Google client secret that was previously committed (old value may still be in history).
- [ ] Scrub unpushed history (M1 Task 3) and confirm `git log --all -S'GOCSPX' --oneline | wc -l` → `0`.
- [ ] Confirm `git ls-files | grep -E '^\.env'` → only `.env.example`.

## 6. Known gaps (out of scope for this pass)

- M2: `output: 'export'`, `public/_headers`, `components.json` — configured for Cloudflare Pages Git integration.
- M4: dead `mood-selector`/`mood-dropdown` code still present; restyle not applied.
- M5: monthly hints + tag filtering not implemented.
