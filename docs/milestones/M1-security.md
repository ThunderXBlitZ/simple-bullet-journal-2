# M1 — Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **Never commit** — the user commits manually; stop at each "CHECKPOINT". Do not run test suites; run only the verify commands listed.

**Goal:** Remove the leaked Google client secret from the project and from unpushed history, and stop persisting OAuth tokens in journal data.

**Architecture:** The app uses the client-only GIS token flow (D1), so no secret is needed at all. Only the public `NEXT_PUBLIC_GOOGLE_CLIENT_ID` stays. Tokens move out of the persisted Zustand state.

**Tech Stack:** git, Google Cloud Console, Zustand `persist`, Next 16.

**Spec:** `docs/milestones/00-design-decisions.md` (D1, D7)

## Global Constraints
- No secret values printed to terminal/logs. Mask with `sed -E 's/=.*/=<masked>/'`; never `cat` env/credential files.
- `origin/main` = `ffe9aae`; local is 10 commits ahead; `633206f` (adds `.env.local`) is **unpushed**. Do not push.
- Never use git worktrees. Never commit.

## Review Focus
- Old IndexedDB blobs already contain `accessToken`/`refreshToken` strings → must disappear on the next write, not linger.
- `.gitignore` has `.env*` → `.env.example` must be re-included or it is silently untracked.
- Scrubbing history must not delete the working-tree `.env.local` (client ID needed to run locally).
- Cloudflare build has no `.env.local` → sign-in is dead in prod until the build variable is set.

---

### Task 1: Revoke the secret (manual, Google Cloud Console)

- [ ] **Step 1:** Console → APIs & Services → Credentials → the OAuth 2.0 Web client (`5711…apps.googleusercontent.com`) → under "Client secrets" **Disable/Delete** the existing secret (the app never uses one). If a new secret is auto-created, delete it too.
- [ ] **Step 2:** Same page → "Authorized JavaScript origins": keep only `http://localhost:3000` and the production Workers URL/custom domain. Remove anything else. No redirect URIs are needed for the GIS token flow.
- [ ] **Step 3:** Delete the stray local file: `rm .google-oauth2-credentials`
- [ ] **Verify:** Console shows no active secret. `ls -a | grep oauth` prints nothing.

### Task 2: Untrack `.env.local`, add `.env.example`

**Files:** Modify `.env.local`, `.gitignore`; Create `.env.example`

- [ ] **Step 1:** Back up the client ID only: `grep '^NEXT_PUBLIC_GOOGLE_CLIENT_ID=' .env.local > ../bj-env-backup`
- [ ] **Step 2:** Rewrite local env to client ID only: `cp ../bj-env-backup .env.local`
- [ ] **Step 3:** Create `.env.example` containing exactly:
```
# Public OAuth client ID (safe to expose; it is shipped to the browser).
# Never add a client_secret here — the app uses the client-only token flow.
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```
- [ ] **Step 4:** In `.gitignore`, directly below the `.env*` line add `!.env.example`.
- [ ] **Step 5:** `git rm --cached .env.local`
- [ ] **Verify:** `git status --short | grep env` → `D  .env.local` and `?? .env.example`. `git check-ignore -v .env.example` prints nothing (not ignored). `git check-ignore -v .env.local` shows the `.env*` rule.

### Task 3: Scrub the secret from unpushed history (user runs; destructive to local history)

> Run only after Task 1 is done. Requires a clean tree except the Task 2 changes.

- [ ] **Step 1:** User commits Task 2: `git add -A && git commit -m "chore: untrack .env.local, add .env.example"`
- [ ] **Step 2:** Rewrite only unpushed commits:
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch --quiet .env.local' origin/main..HEAD
```
- [ ] **Step 3:** Restore the working copy (the rewrite checks out a tree without it): `cp ../bj-env-backup .env.local`
- [ ] **Step 4:** Purge backups: 
```bash
rm -rf .git/refs/original
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```
- [ ] **Verify:** `git log --all -S'GOCSPX' --oneline | wc -l` → `0`. `git ls-files | grep -E '^\.env'` → only `.env.example`. `git rev-list origin/main..HEAD --count` → still ≈10–11. `git branch -r --contains $(git rev-list HEAD | tail -1)` unaffected.
- [ ] **CHECKPOINT (user):** safe to push once Verify passes.

### Task 4: Tokens out of persisted journal state

**Files:** Modify `lib/journal-store.ts`, `lib/types.ts`, `app/page.tsx`, `components/journal/settings-modal.tsx`

- [ ] **Step 1:** In `lib/types.ts` `JournalState`, delete `accessToken` and `refreshToken` lines.
- [ ] **Step 2:** In `lib/journal-store.ts`: delete `accessToken`/`refreshToken` initial values (lines ~131–132); change the action type and impl to `setGoogleUser: (googleId: string, email: string) => void` / `set({ googleId, googleEmail: email, authMethod: "google" })`; in `clearGoogleAuth` and `resetStore` delete the two token lines.
- [ ] **Step 3:** Add to the persist options (after `skipHydration: true`):
```ts
partialize: (state) => {
  const { isSyncing, ...rest } = state as typeof state & { accessToken?: unknown; refreshToken?: unknown }
  delete (rest as Record<string, unknown>).accessToken
  delete (rest as Record<string, unknown>).refreshToken
  return rest
},
```
(Functions are dropped by JSON; this strips tokens + `isSyncing` from any write, including blobs rehydrated from old data.)
- [ ] **Step 4:** Fix call sites: `grep -rn "setGoogleUser" app components lib` → pass only `(id, email)`.
- [ ] **Step 5:** `npx tsc --noEmit | tail -n 20` → no errors.
- [ ] **Verify (browser, `npm run dev`):** sign in with Google, add one entry, then paste in DevTools console:
```js
indexedDB.open('BulletJournalDB').onsuccess=e=>{const r=e.target.result.transaction('data').objectStore('data').getAll();r.onsuccess=()=>console.log(r.result.map(v=>/"(accessToken|refreshToken)":"[^"]/.test(v)))}
```
Expect every element `false`. Reload: still signed in (token still restored from `meta` store). 

### Task 5: Dependency & prod config audit

- [ ] **Step 1:** `npm audit --omit=dev 2>&1 | tail -n 20` → record High/Critical in `docs/milestones/M1-security.md` under `## Outcome`; upgrade only if a non-breaking patch exists (`npm audit fix --omit=dev`), else note it.
- [ ] **Step 2 (manual, Cloudflare dashboard):** Workers & Pages → project → Settings → Variables and Secrets (**Build** variables): add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = the public client ID. Redeploy.
- [ ] **Verify:** Production sign-in popup opens (no `idpiframe`/`invalid_client` error).

## Outcome
_(filled in at completion)_
