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
