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
