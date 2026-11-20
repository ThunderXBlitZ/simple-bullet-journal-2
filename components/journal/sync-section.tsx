"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { RefreshCWIcon } from "@/components/icons/refresh-cw"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { useSyncStatus } from "@/lib/sync/status"
import { syncNow } from "@/lib/sync/engine"
import { connectGoogle, reconnectGoogle } from "@/lib/sync/link"
import { GOOGLE_CLIENT_ID } from "@/lib/google/config"

const friendly = (e: unknown) => {
  const m = e instanceof Error ? e.message : "Sign-in failed"
  return m === "popup_closed" ? "Sign-in was cancelled." : m === "popup_failed_to_open" ? "The sign-in popup was blocked. Allow popups and try again." : m
}

export function SyncSection() {
  const { syncAccountId, googleEmail } = useJournalStore(useShallow((s) => ({ syncAccountId: s.syncAccountId, googleEmail: s.googleEmail })))
  const { status, message, lastSyncTime } = useSyncStatus()
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
    <div className="space-y-3">
      <label className="text-sm font-medium font-serif">Google</label>
      {!syncAccountId ? (
        <>
          <p className="text-xs text-muted-foreground">Back up and sync this journal across devices. Stored privately in your Drive's app folder.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(connectGoogle)}>Sign in with Google</Button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm truncate">{googleEmail}</p>
            {status === "reauth" ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(reconnectGoogle)}>Reconnect</Button>
            ) : (
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Sync now" disabled={busy || status === "syncing"} onClick={() => run(syncNow)}>
                <RefreshCWIcon size={16} />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">{line}</p>
          <p className="text-xs text-muted-foreground">Signing in as a different account replaces it (a backup file is downloaded first).</p>
        </>
      )}
    </div>
  )
}
