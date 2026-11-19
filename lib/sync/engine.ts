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
