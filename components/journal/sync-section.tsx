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

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-label="Google" role="img">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
)

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
    : status === "reauth" ? null
    : status === "error" ? message
    : lastSyncTime ? `Synced ${formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}`
    : "Not synced yet"

  return (
    <div className="space-y-3">
      {!syncAccountId ? (
        <>
          <p className="text-xs text-muted-foreground">Back up and sync this journal across devices. Stored privately in your Drive's app folder.</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run(connectGoogle)}>Sign in with Google</Button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <GoogleIcon />
            <p className="text-sm truncate min-w-0 flex-1">{googleEmail}</p>
            {status === "reauth" ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => run(reconnectGoogle)}>Reconnect</Button>
            ) : (
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Sync now" disabled={busy || status === "syncing"} onClick={() => run(syncNow)}>
                <RefreshCWIcon size={16} />
              </Button>
            )}
          </div>
          {line && <p className="text-xs text-muted-foreground" aria-live="polite">{line}</p>}
        </>
      )}
    </div>
  )
}
