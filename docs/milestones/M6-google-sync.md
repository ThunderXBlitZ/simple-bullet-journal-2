# M6 — Google Login & Drive Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Checkbox steps. **Never commit** (user does). Don't run test suites. Verification is manual (two browser profiles) plus `tsc`/`build`. Requires M3 complete (merge, backup, store shape).

**Goal:** Sign in with Google, link the journal to that account, and keep it in sync across devices via per-record merge in Drive `appDataFolder` — with clear status, safe account switching, and no sync loops.

**Architecture:** `lib/google/auth.ts` implements an `AuthProvider` (GIS token flow, in-memory token with expiry). `lib/google/drive.ts` is a dumb transport (read/write one file with a version check). `lib/sync/engine.ts` does pull → merge → apply → push (retry on version conflict). Sync status/last-sync live **outside** the persisted store so a no-op sync never writes state (prevents cross-tab ping-pong).

**Tech Stack:** Google Identity Services (token model), Drive v3 REST, Zustand, existing `mergeJournals` (M3), zod.

**Spec:** `docs/milestones/00-design-decisions.md` (D1, D3, D5, D6)

## Global Constraints
- Scope only `https://www.googleapis.com/auth/drive.appdata` + `userinfo.email` + `userinfo.profile`; no `client_secret`, no backend.
- Drive file `bullet-journal.json`, body `{ app: "bullet-journal", schema: 2, updatedAt, data: JournalData }`. Legacy `bullet-journal-backup.json` is read-only fallback (never modified/deleted).
- Never write to Drive if the remote file is unreadable or has `schema > 2`.
- Device-local, never synced: `settings`, tokens, sync status.
- First link = per-record merge; different account = replace local after automatic backup download (D6).
- Source files ≤400 lines.

## Review Focus
- User edits while a sync is in flight must survive (apply step re-merges with *current* local state).
- Idle app, one or two tabs open: zero Drive requests (no loop); `visibilitychange` sync at most every 30s.
- Reconnect popup answered with the *wrong* Google account must not sync that account's Drive with this journal.
- User unticks the Drive permission on the consent screen (granular consent) → clear error, not a silent failure.
- Offline at load: no crash, status says offline, local editing unaffected; sync resumes on `online`.
- Remote file corrupted / from a newer schema → status error, remote untouched.
- Two devices first-syncing at the same moment create two files → both converge on the oldest (`orderBy=createdTime`) and merge on next sync (no data loss).
- Old Drive snapshot (pre-M6 users) is merged in once and a new-format file is created.
- Signing out keeps the account link; signing in as another account triggers replace+backup (D6), including when that account has an empty Drive (journal becomes empty after the backup download).

---

### Task 0: Google Cloud checks (manual)

- [ ] OAuth consent screen: publishing status "In production" (or your account listed under Test users); scopes listed: `…/auth/drive.appdata`, `userinfo.email`, `userinfo.profile` (`drive.appdata` is non-sensitive → no verification needed).
- [ ] Credentials → Authorized JavaScript origins include `http://localhost:3000`, `http://localhost:8787` and the production URL (done in M1/M2).
- [ ] Drive API is enabled for the project.

### Task 1: Config, auth interface, auth rewrite

**Files:** Create `lib/google/config.ts`, `lib/auth/types.ts`; Replace `lib/google/auth.ts`; Modify `lib/journal-store.ts`

- [ ] **Step 1:** `lib/google/config.ts`:
```ts
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.appdata",
]
```
Delete the `GOOGLE_CONFIG` export from `lib/journal-store.ts`; `grep -rn GOOGLE_CONFIG app components lib` → no hits.
- [ ] **Step 2:** `lib/auth/types.ts`:
```ts
export interface AuthUser {
  id: string
  email: string
  name: string
}

/** Swappable per platform (web GIS now; native plugin under Capacitor later). */
export interface AuthProvider {
  /** Load SDK; safe to call repeatedly. */
  init(): Promise<void>
  /** Interactive sign-in (needs a user gesture). Pass `hint` (email) to pre-select an account. */
  signIn(hint?: string): Promise<AuthUser>
  /** Background token refresh, no UI. If `accountId` is given, a token for a different account is rejected. */
  silentRefresh(opts?: { hint?: string; accountId?: string }): Promise<boolean>
  /** Restore a still-valid persisted token on startup. */
  restore(): Promise<void>
  /** Current token, or null if absent/expired. */
  getToken(): string | null
  signOut(): void
}
```
- [ ] **Step 3:** Replace `lib/google/auth.ts` entirely:
```ts
/** Google Identity Services (token model) implementation of AuthProvider. */

import { persistGoogleToken, getPersistedGoogleToken, clearPersistedGoogleToken } from "../storage/zustand-adapter"
import type { AuthProvider, AuthUser } from "../auth/types"
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from "./config"

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string; hint?: string }) => void
}

const EXPIRY_BUFFER_MS = 60_000

let tokenClient: TokenClient | null = null
let initPromise: Promise<void> | null = null
let accessToken: string | null = null
let expiryMs = 0
let pending: { resolve: (r: TokenResponse) => void; reject: (e: Error) => void } | null = null
let lastAccount: { id?: string; email?: string } = {}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement("script")
    s.src = "https://accounts.google.com/gsi/client"
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Couldn't load Google sign-in (offline or blocked)"))
    document.head.appendChild(s)
  })
}

function init(): Promise<void> {
  initPromise ??= loadScript()
    .then(() => {
      tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES.join(" "),
        callback: (r: TokenResponse) => {
          const p = pending
          pending = null
          if (!p) return
          if (r.error) p.reject(new Error(r.error))
          else p.resolve(r)
        },
        error_callback: (e: { type: string }) => {
          const p = pending
          pending = null
          p?.reject(new Error(e.type)) // popup_closed, popup_failed_to_open, …
        },
      })
    })
    .catch((e) => {
      initPromise = null
      throw e
    })
  return initPromise
}

async function requestToken(opts: { prompt: string; hint?: string }): Promise<void> {
  await init()
  if (pending) throw new Error("Sign-in already in progress")
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    pending = { resolve, reject }
    tokenClient!.requestAccessToken(opts)
  })
  if (!response.access_token) throw new Error("No access token received")
  if (!window.google!.accounts.oauth2.hasGrantedAllScopes(response, ...GOOGLE_SCOPES)) {
    throw new Error("Google Drive access wasn't granted. Sign in again and tick the Drive permission.")
  }
  accessToken = response.access_token
  expiryMs = Date.now() + (response.expires_in ?? 3600) * 1000
  persistGoogleToken(accessToken, expiryMs)
}

async function fetchUserInfo(): Promise<AuthUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error("Failed to fetch Google account info")
  const d = await res.json()
  return { id: d.id, email: d.email, name: d.name ?? d.email }
}

function clearToken(): void {
  accessToken = null
  expiryMs = 0
  clearPersistedGoogleToken()
}

export const googleAuth: AuthProvider = {
  init,

  async signIn(hint) {
    await requestToken({ prompt: hint ? "" : "select_account", hint })
    const user = await fetchUserInfo()
    lastAccount = { id: user.id, email: user.email }
    return user
  },

  async silentRefresh(opts) {
    const hint = opts?.hint ?? lastAccount.email
    const accountId = opts?.accountId ?? lastAccount.id
    try {
      await requestToken({ prompt: "none", hint })
      if (accountId && (await fetchUserInfo()).id !== accountId) {
        clearToken()
        return false
      }
      lastAccount = { id: accountId, email: hint }
      return true
    } catch {
      return false
    }
  },

  async restore() {
    const stored = await getPersistedGoogleToken()
    if (stored && Date.now() < stored.expiryMs - EXPIRY_BUFFER_MS) {
      accessToken = stored.token
      expiryMs = stored.expiryMs
    }
  },

  getToken: () => (accessToken && Date.now() < expiryMs - EXPIRY_BUFFER_MS ? accessToken : null),

  signOut() {
    if (accessToken) window.google?.accounts.oauth2.revoke(accessToken, () => {})
    clearToken()
  },
}

/** Used by drive.ts (401 retry path). */
export const getAccessToken = (): string | null => googleAuth.getToken()

export async function refreshAccessToken(): Promise<string> {
  if (!(await googleAuth.silentRefresh())) throw new Error("Token refresh failed")
  return accessToken!
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: unknown) => TokenClient
          hasGrantedAllScopes: (response: TokenResponse, ...scopes: string[]) => boolean
          revoke: (token: string, done: () => void) => void
        }
      }
    }
  }
}
```
- [ ] **Step 4 — store:** in `lib/types.ts` `JournalState` and `lib/journal-store.ts`: delete `lastSyncTime` and `setLastSyncTime` (initial state, interface, action). Add the action:
```ts
resetJournalData: () => void  // interface
resetJournalData: () =>
  set({
    dailyLogs: {}, tags: initializePresetTags(), habits: [], habitCompletions: [], collections: [],
    userName: "", userNameUpdatedAt: "1970-01-01T00:00:00.000Z", tombstones: {},
  }),
```
(keeps `settings`, `googleEmail`, `syncAccountId`; used only by account switch.)
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` — only errors in `drive.ts` (fixed next).

### Task 2: Drive transport

**Files:** Modify `lib/google/drive.ts` (keep lines 1–166: `SyncErrorType`, `SyncError`, `classifyResponse`, `withRetry`)

- [ ] **Step 1:** Change constants: `const FILE_NAME = 'bullet-journal.json'` and add `const LEGACY_FILE_NAME = 'bullet-journal-backup.json'`.
- [ ] **Step 2:** Delete everything from `uploadToDrive` (l.168) to the end of the file and append:
```ts
export interface RemoteFile {
  text: string | null
  fileId: string | null // id of the *new-format* file (null if absent or only legacy exists)
  version: string | null
  legacy: boolean // true when text came from the legacy snapshot file
}

/** Token is read per attempt, so a refresh inside withRetry is actually used. */
function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  if (!token) throw new SyncError(SyncErrorType.AUTH_EXPIRED, 'Not authenticated with Google')
  return { Authorization: `Bearer ${token}` }
}

async function findFile(name: string): Promise<{ id: string; version: string } | null> {
  const q = encodeURIComponent(`name='${name}'`)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=createdTime&pageSize=1&fields=files(id,version)`,
    { headers: authHeaders() },
  )
  const error = classifyResponse(res)
  if (error) throw error
  const f = (await res.json()).files?.[0]
  return f ? { id: f.id, version: String(f.version) } : null
}

async function readContent(id: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: authHeaders() })
  const error = classifyResponse(res)
  if (error) throw error
  return res.text()
}

/** Reads the sync file (falls back to the legacy snapshot, read-only). Version is read *before* content. */
export async function readSyncFile(): Promise<RemoteFile> {
  return withRetry(async () => {
    const current = await findFile(FILE_NAME)
    if (current) return { text: await readContent(current.id), fileId: current.id, version: current.version, legacy: false }
    const legacy = await findFile(LEGACY_FILE_NAME)
    if (legacy) return { text: await readContent(legacy.id), fileId: null, version: null, legacy: true }
    return { text: null, fileId: null, version: null, legacy: false }
  })
}

async function createFile(text: string): Promise<void> {
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ name: FILE_NAME, mimeType: MIME_TYPE, parents: [FOLDER_NAME] })], { type: 'application/json' }))
  form.append('file', new Blob([text], { type: MIME_TYPE }))
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  const error = classifyResponse(res)
  if (error) throw error
}

/**
 * Writes the sync file. Returns "conflict" (nothing written) if the remote changed since it was read,
 * so the caller re-pulls and re-merges. Version check is a narrow window, not a lock; merge makes it safe.
 */
export async function writeSyncFile(
  text: string,
  expect: { fileId: string | null; version: string | null },
): Promise<'ok' | 'conflict'> {
  return withRetry(async () => {
    if (!expect.fileId) {
      await createFile(text)
      return 'ok' as const
    }
    const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${expect.fileId}?fields=version`, { headers: authHeaders() })
    if (meta.status === 404) return 'conflict' as const // file vanished → re-pull will recreate
    const metaError = classifyResponse(meta)
    if (metaError) throw metaError
    if (String((await meta.json()).version) !== expect.version) return 'conflict' as const

    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${expect.fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': MIME_TYPE },
      body: text,
    })
    const error = classifyResponse(res)
    if (error) throw error
    return 'ok' as const
  })
}
```
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean (drive.ts imports `getAccessToken`, `refreshAccessToken` from `./auth` — still exported).

### Task 3: Remote format, status store, engine, link flow

**Files:** Create `lib/sync/remote-format.ts`, `lib/sync/status.ts`, `lib/sync/engine.ts`, `lib/sync/link.ts`; Modify `lib/backup.ts`

- [ ] **Step 1:** `lib/backup.ts`: rename `const dataSchema` → `export const journalDataSchema` (and update its use in `backupSchema`).
- [ ] **Step 2:** `lib/sync/remote-format.ts`:
```ts
import type { JournalData } from "../journal-data"
import { journalDataSchema } from "../backup"
import { upgradeLegacyState } from "../storage/legacy-migration"

export class RemoteTooNewError extends Error {}
export class RemoteInvalidError extends Error {}

export const serializeRemote = (data: JournalData): string =>
  JSON.stringify({ app: "bullet-journal", schema: 2, updatedAt: new Date().toISOString(), data })

/** Accepts schema-2 files and the legacy (pre-M6) snapshot. Never returns partial data. */
export function parseRemote(text: string): JournalData {
  let obj: any
  try {
    obj = JSON.parse(text)
  } catch {
    throw new RemoteInvalidError("Drive file is not valid JSON")
  }
  if (obj?.app === "bullet-journal" && typeof obj.schema === "number") {
    if (obj.schema > 2) throw new RemoteTooNewError()
    const parsed = journalDataSchema.safeParse(obj.data)
    if (!parsed.success) throw new RemoteInvalidError("Drive file failed validation")
    return parsed.data as JournalData
  }
  if (obj && typeof obj === "object" && "dailyLogs" in obj) return upgradeLegacyState(obj).data
  throw new RemoteInvalidError("Drive file has an unknown format")
}
```
- [ ] **Step 3:** `lib/sync/status.ts`:
```ts
import { create } from "zustand"
import { getStorageProvider } from "../storage/storage"

export type SyncStatus = "idle" | "syncing" | "error" | "reauth"

interface SyncStatusState {
  status: SyncStatus
  message: string | null
  lastSyncTime: string | null
  set: (status: SyncStatus, message?: string | null) => void
  markSynced: () => void
  loadLastSync: () => Promise<void>
}

/** Not persisted with the journal: changing it must never write journal state (prevents cross-tab loops). */
export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: "idle",
  message: null,
  lastSyncTime: null,
  set: (status, message = null) => set({ status, message }),
  markSynced: () => {
    const now = new Date().toISOString()
    set({ lastSyncTime: now })
    getStorageProvider().setMeta("lastSyncTime", now).catch(console.error)
  },
  loadLastSync: async () => set({ lastSyncTime: await getStorageProvider().getMeta("lastSyncTime") }),
}))
```
- [ ] **Step 4:** `lib/sync/engine.ts`:
```ts
import { useJournalStore } from "../journal-store"
import { pickJournalData, type JournalData } from "../journal-data"
import { mergeJournals } from "./merge"
import { parseRemote, serializeRemote, RemoteInvalidError, RemoteTooNewError } from "./remote-format"
import { googleAuth } from "../google/auth"
import { readSyncFile, writeSyncFile, SyncError, SyncErrorType } from "../google/drive"
import { useSyncStatus } from "./status"

export type SyncResult = "ok" | "reauth" | "error"

const DEBOUNCE_MS = 5000
const FOCUS_THROTTLE_MS = 30_000
const MAX_ATTEMPTS = 3

const canon = (d: JournalData): string => JSON.stringify(mergeJournals(d, d))

let running: Promise<SyncResult> | null = null
let lastRun = 0
let applyingRemote = false

export function syncNow(): Promise<SyncResult> {
  running ??= run().finally(() => {
    running = null
    lastRun = Date.now()
  })
  return running
}

async function run(): Promise<SyncResult> {
  const status = useSyncStatus.getState()
  status.set("syncing")
  try {
    const { googleEmail, syncAccountId } = useJournalStore.getState()
    if (!googleAuth.getToken() && !(await googleAuth.silentRefresh({ hint: googleEmail ?? undefined, accountId: syncAccountId ?? undefined }))) {
      status.set("reauth")
      return "reauth"
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const remote = await readSyncFile()
      const remoteData = remote.text ? parseRemote(remote.text) : null // throws → nothing is written
      const local = pickJournalData(useJournalStore.getState())
      const merged = mergeJournals(local, remoteData ?? local)
      const mergedCanon = JSON.stringify(merged)

      // Re-merge with *current* local so edits made during the network calls survive.
      const current = pickJournalData(useJournalStore.getState())
      const next = mergeJournals(current, merged)
      if (canon(current) !== JSON.stringify(next)) {
        applyingRemote = true
        try {
          useJournalStore.setState(next)
        } finally {
          applyingRemote = false
        }
      }

      const needsPush = !remoteData || remote.legacy || canon(remoteData) !== mergedCanon
      if (needsPush) {
        const result = await writeSyncFile(serializeRemote(merged), { fileId: remote.fileId, version: remote.version })
        if (result === "conflict") continue
      }
      status.markSynced()
      status.set("idle")
      return "ok"
    }
    status.set("error", "Another device is syncing. Will retry shortly.")
    return "error"
  } catch (e) {
    return handleError(e)
  }
}

function handleError(e: unknown): SyncResult {
  const { set } = useSyncStatus.getState()
  if (e instanceof RemoteTooNewError) set("error", "Your Drive journal was saved by a newer version of the app. Refresh to update.")
  else if (e instanceof RemoteInvalidError) set("error", `Drive file can't be read (${e.message}). Nothing was overwritten.`)
  else if (e instanceof SyncError && e.type === SyncErrorType.AUTH_EXPIRED) {
    set("reauth")
    return "reauth"
  } else if (e instanceof SyncError && e.type === SyncErrorType.FORBIDDEN) set("error", "Google Drive access was denied. Reconnect and allow Drive access.")
  else if (e instanceof SyncError && e.type === SyncErrorType.NETWORK) set("error", "Offline. Will retry when you're back online.")
  else {
    console.error("Sync failed", e)
    set("error", "Sync failed. Will retry.")
  }
  return "error"
}

const isLinked = (): boolean => !!useJournalStore.getState().syncAccountId

const DATA_KEYS = ["dailyLogs", "tags", "habits", "habitCompletions", "collections", "userName", "tombstones"] as const

/** Start background sync; returns a stop function. Call once, after hydration + auth restore. */
export function startAutoSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), delay)
  }

  const unsubscribe = useJournalStore.subscribe((s, prev) => {
    if (applyingRemote || !isLinked()) return
    if (DATA_KEYS.some((k) => (s as any)[k] !== (prev as any)[k])) schedule(DEBOUNCE_MS)
  })
  const onVisible = () => {
    if (document.visibilityState === "visible" && isLinked() && Date.now() - lastRun > FOCUS_THROTTLE_MS) void syncNow()
  }
  const onOnline = () => isLinked() && void syncNow()
  document.addEventListener("visibilitychange", onVisible)
  window.addEventListener("online", onOnline)

  return () => {
    unsubscribe()
    if (timer) clearTimeout(timer)
    document.removeEventListener("visibilitychange", onVisible)
    window.removeEventListener("online", onOnline)
  }
}
```
- [ ] **Step 5:** `lib/sync/link.ts`:
```ts
import { toast } from "sonner"
import { useJournalStore } from "../journal-store"
import { googleAuth } from "../google/auth"
import { downloadBackup } from "../backup"
import { syncNow } from "./engine"

/** Sign in and link/switch. First link merges (D5); a different account replaces local after a backup download (D6). */
export async function connectGoogle(): Promise<"linked" | "switched"> {
  const user = await googleAuth.signIn()
  const store = useJournalStore.getState()
  const switching = !!store.syncAccountId && store.syncAccountId !== user.id
  if (switching) {
    downloadBackup() // previous journal, as a file, before it is replaced
    store.resetJournalData()
  }
  store.setLinkedAccount(user.id, user.email)
  await syncNow()
  if (switching) toast.message("Switched account. Your previous journal was downloaded as a backup file.")
  return switching ? "switched" : "linked"
}

/** Re-auth for the already-linked account; refuses a different account (would mix journals). */
export async function reconnectGoogle(): Promise<void> {
  const { syncAccountId, googleEmail } = useJournalStore.getState()
  const user = await googleAuth.signIn(googleEmail ?? undefined)
  if (syncAccountId && user.id !== syncAccountId) {
    googleAuth.signOut()
    throw new Error(`Please sign in as ${googleEmail}, or use "Sign in with Google" to switch accounts.`)
  }
  await syncNow()
}
```
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean.

### Task 4: UI and wiring

**Files:** Create `components/journal/sync-section.tsx`, `components/journal/sync-banner.tsx`; Modify `components/journal/settings-modal.tsx`, `components/journal/setup-modal.tsx`, `app/page.tsx`

- [ ] **Step 1:** `components/journal/sync-section.tsx`:
```tsx
"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { LogOut, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { useSyncStatus } from "@/lib/sync/status"
import { syncNow } from "@/lib/sync/engine"
import { connectGoogle, reconnectGoogle } from "@/lib/sync/link"
import { googleAuth } from "@/lib/google/auth"
import { GOOGLE_CLIENT_ID } from "@/lib/google/config"

const friendly = (e: unknown) => {
  const m = e instanceof Error ? e.message : "Sign-in failed"
  return m === "popup_closed" ? "Sign-in was cancelled." : m === "popup_failed_to_open" ? "The sign-in popup was blocked. Allow popups and try again." : m
}

export function SyncSection() {
  const { syncAccountId, googleEmail } = useJournalStore()
  const { status, message, lastSyncTime, set } = useSyncStatus()
  const [busy, setBusy] = useState(false)
  if (!GOOGLE_CLIENT_ID) return null

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error(friendly(e))
    } finally {
      setBusy(false)
    }
  }

  const line =
    status === "syncing" ? "Syncing…"
    : status === "reauth" ? "Paused — reconnect to resume."
    : status === "error" ? message
    : lastSyncTime ? `Synced ${formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}`
    : "Not synced yet"

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Google Drive</h3>
      {!syncAccountId ? (
        <>
          <p className="text-xs text-muted-foreground">Back up and sync this journal across devices. Stored privately in your Drive's app folder.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(connectGoogle)}>Sign in with Google</Button>
        </>
      ) : (
        <>
          <p className="text-sm">{googleEmail}</p>
          <p className="text-xs text-muted-foreground" aria-live="polite">{line}</p>
          <div className="flex flex-wrap gap-2">
            {status === "reauth" ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(reconnectGoogle)}>Reconnect</Button>
            ) : (
              <Button variant="outline" size="sm" disabled={busy || status === "syncing"} onClick={() => run(syncNow)}>
                <RefreshCw className="w-4 h-4 mr-2" />Sync now
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { googleAuth.signOut(); set("reauth") }}>
              <LogOut className="w-4 h-4 mr-2" />Sign out
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Signing out keeps this journal linked to {googleEmail}. Signing in as a different account replaces it (a backup file is downloaded first).</p>
        </>
      )}
    </div>
  )
}
```
- [ ] **Step 2:** `components/journal/sync-banner.tsx`:
```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { useSyncStatus } from "@/lib/sync/status"
import { reconnectGoogle } from "@/lib/sync/link"

export function SyncBanner() {
  const status = useSyncStatus((s) => s.status)
  const linked = useJournalStore((s) => s.syncAccountId)
  const [busy, setBusy] = useState(false)
  if (status !== "reauth" || !linked) return null

  return (
    <div role="status" className="flex items-center justify-between gap-2 border-b border-border px-4 py-1.5 text-sm">
      <span>Google Drive sync is paused.</span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await reconnectGoogle()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Reconnect failed")
          } finally {
            setBusy(false)
          }
        }}
      >
        Reconnect
      </Button>
    </div>
  )
}
```
- [ ] **Step 3:** `settings-modal.tsx`: import and render `<SyncSection />` above `<BackupSection />`.
- [ ] **Step 4:** `setup-modal.tsx`: below the "Start journaling" button add (import `toast`, `connectGoogle`, `GOOGLE_CLIENT_ID`):
```tsx
{GOOGLE_CLIENT_ID && (
  <Button
    variant="outline"
    onClick={async () => {
      try {
        await connectGoogle()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sign-in failed")
      }
    }}
  >
    Restore from Google Drive
  </Button>
)}
```
(After a successful restore `userName` becomes non-empty → the dialog unmounts; if the Drive was empty the dialog stays so the user can enter a name — the account link is already saved.)
- [ ] **Step 5:** `app/page.tsx`: import `googleAuth`, `startAutoSync`, `syncNow`, `useSyncStatus`, `GOOGLE_CLIENT_ID`, `SyncBanner`. Add after the init effect:
```tsx
useEffect(() => {
  if (!mounted || !GOOGLE_CLIENT_ID) return
  let stop = () => {}
  let cancelled = false
  ;(async () => {
    await useSyncStatus.getState().loadLastSync()
    try {
      await googleAuth.init()
    } catch {
      return // offline / blocked: local-only until next load
    }
    await googleAuth.restore()
    if (cancelled) return
    stop = startAutoSync()
    if (useJournalStore.getState().syncAccountId) void syncNow()
  })()
  return () => {
    cancelled = true
    stop()
  }
}, [mounted])
```
and render `<SyncBanner />` as the first child inside the layout root (above the flex row's `<main>` area — place it directly above `<main>` inside a `flex-1 flex flex-col` wrapper if needed so it spans the content column, not the sidebar).
- [ ] **Step 6:** Delete now-dead files/refs: `grep -rn "uploadToDrive\|downloadFromDrive\|getLastSyncTime\|setLastSyncTime\|lastSyncTime" app components lib` → only `lib/sync/*` and `status` usages remain.
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean; `npm run build 2>&1 | tail -n 10` succeeds.

### Task 5: Docs

- [ ] Replace `GOOGLE_SYNC_GUIDE.md` (stale: describes the old 3-strategy modal/undo) with ≤60 lines covering: how linking works (first link merges; different account replaces + backup), what's stored (`bullet-journal.json` in app folder; legacy file left alone), sync triggers, statuses (Synced/Syncing/Paused/Error), sign-out semantics, and recovery (export JSON / Drive file location). 
- [ ] Update `CLAUDE.md` file map (add `lib/sync/`, `lib/auth/`, `components/icons/`, `scripts/`), rewrite `docs/STATE.md` (M6 done; remaining deploy checks), append to `docs/CHANGELOG.md`, fix `USER_STORIES.md` (remove mood/gratitude/localStorage/emoji claims; add sync, filter, month summary).
- [ ] `wc -l CLAUDE.md docs/STATE.md docs/ROADMAP.md` within budgets.

### Task 6: Manual verification (user) — use two browser profiles (A, B), same Google account

- [ ] **Sign-in & link (A):** Settings → Sign in with Google → consent (tick Drive) → "Synced just now". Drive file exists: `https://drive.google.com/drive/u/0/settings` → Manage apps → app has hidden data (or verify by step below).
- [ ] **Restore on B:** fresh profile → "Restore from Google Drive" → name + entries appear.
- [ ] **Propagation:** add entry in A → within ≤35s (switch to B tab / focus) it appears in B. Delete it in A → disappears in B. Edit the same entry in both while B is offline (DevTools → Offline) → reconnect → newest edit wins in both, nothing else lost. Delete a tag in A → gone in B, entries intact.
- [ ] **In-flight edit:** DevTools → Network throttle "Slow 3G"; type entries while a sync runs → after completion all typed entries exist locally and reach Drive on the next sync.
- [ ] **No loop:** with A signed in and idle, Network tab filter `googleapis` for 90s → no requests except on focus/online/after edits. Two tabs of A open: still none.
- [ ] **Token expiry:** DevTools → Application → IndexedDB → `meta` → set `googleAuth/tokenExpiry` to `0`, reload → either silent resume, or the banner "Google Drive sync is paused" → Reconnect → "Synced". Local data untouched throughout.
- [ ] **Revoked access:** revoke at myaccount.google.com/permissions, trigger Sync now → banner/Reconnect → consent returns.
- [ ] **Wrong account on reconnect:** with an expired token, click Reconnect and pick a *different* Google account → error toast, nothing synced to that account.
- [ ] **Account switch (D6):** sign out, then Sign in as another account → a backup JSON downloads, journal becomes that account's data (empty if new), previous account's Drive untouched. Re-import the backup file to confirm it's complete.
- [ ] **Legacy Drive snapshot:** if you have the old `bullet-journal-backup.json` on Drive, sign in on a fresh profile → data appears; a new `bullet-journal.json` is created; the legacy file is still present.
- [ ] **Granular consent:** on consent untick Drive → error toast "Google Drive access wasn't granted…"; nothing linked.
- [ ] **Offline load:** reload while offline → app works, banner/status shows offline error, back online → syncs.
- [ ] **Corrupt remote:** (optional, dev only) overwrite the Drive file body with `{}` → status error "can't be read", local data and Drive file unchanged.
- [ ] **Production:** after the user pushes and Cloudflare deploys → repeat sign-in + one propagation test on the production URL; DevTools console has no CSP violations.

## Outcome
_(filled at completion)_
