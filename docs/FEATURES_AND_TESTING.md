# Test Guide

Features and sync behavior: `GOOGLE_SYNC_GUIDE.md`, `USER_STORIES.md`, `docs/milestones/00-design-decisions.md`.

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
npx tsx scripts/verify-merge.ts  # 11 PASS lines, no FAIL (downloads tsx on first run)
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
- [ ] Settings → Google → **Sign in with Google** → consent, **tick Drive**.
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
- [ ] Reload while signed in: sync resumes silently, or the banner appears -> **Reconnect** -> `Synced`. Local data untouched. (Tokens are memory-only; there is nothing in IndexedDB `meta` to edit.)

### 4.8 Revoked access
- [ ] Revoke at myaccount.google.com/permissions → the sync icon → banner/Reconnect → consent returns.

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
