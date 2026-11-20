/**
 * Zustand storage adapter for our custom StorageProvider.
 * Backed by IndexedDB, no localStorage.
 */

import type { PersistStorage, StorageValue } from "zustand/middleware"
import { getStorageProvider } from "./storage"
import { announceWrite } from "./cross-tab"

/** Access tokens are memory-only now (re-minted by silentRefresh); drop any stored by older versions. */
export function purgeLegacyGoogleToken(): void {
  getStorageProvider().removeMeta("googleAuth/accessToken").catch(console.error)
  getStorageProvider().removeMeta("googleAuth/tokenExpiry").catch(console.error)
}

// ── Zustand storage adapter ───────────────────────────────────────────────────

const DEBOUNCE_MS = 300

/**
 * Create a Zustand PersistStorage adapter backed by IndexedDB.
 * Writes are debounced (typing fires one set() per keystroke) and flushed when the tab is hidden.
 * Skips identical writes: breaks cross-tab rehydrate→write→broadcast loops.
 */
export function createZustandStorage<T>(): PersistStorage<T> {
  let last: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { key: string; value: StorageValue<T> } | null = null

  const cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    pending = null
  }

  const flush = async () => {
    const job = pending
    cancel()
    if (!job) return
    try {
      const serialized = JSON.stringify(job.value)
      if (serialized === last) return
      last = serialized
      await getStorageProvider().setItem(job.key, serialized)
      announceWrite()
    } catch (error) {
      console.error("Failed to set item in storage:", error)
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => void flush())
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void flush())
  }

  return {
    getItem: async (key) => {
      try {
        const value = await getStorageProvider().getItem(key)
        last = value
        return value ? (JSON.parse(value) as StorageValue<T>) : null
      } catch (error) {
        console.error("Failed to get item from storage:", error)
        return null
      }
    },

    setItem: (key, value) => {
      pending = { key, value }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void flush(), DEBOUNCE_MS)
    },

    removeItem: async (key) => {
      cancel()
      last = null
      await getStorageProvider().removeItem(key).catch((e) => console.error("Failed to remove item from storage:", e))
    },
  }
}
