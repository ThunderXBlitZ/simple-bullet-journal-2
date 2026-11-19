/**
 * Zustand storage adapter for our custom StorageProvider.
 * Also exposes helpers for the Google auth token — all backed by IndexedDB, no localStorage.
 */

import type { PersistStorage, StorageValue } from "zustand/middleware"
import { getStorageProvider } from "./storage"
import { announceWrite } from "./cross-tab"

// ── Google Auth Token ─────────────────────────────────────────────────────

/**
 * Persist the Google access token and its expiry epoch (ms) to IndexedDB.
 * Call after a successful sign-in or silent refresh.
 */
export function persistGoogleToken(token: string, expiryMs: number): void {
  getStorageProvider().setMeta("googleAuth/accessToken", token).catch(console.error)
  getStorageProvider().setMeta("googleAuth/tokenExpiry", String(expiryMs)).catch(console.error)
}

/**
 * Read the persisted Google access token. Returns null if absent or expired.
 */
export async function getPersistedGoogleToken(): Promise<{ token: string; expiryMs: number } | null> {
  const token = await getStorageProvider().getMeta("googleAuth/accessToken")
  const expiryRaw = await getStorageProvider().getMeta("googleAuth/tokenExpiry")
  if (!token || !expiryRaw) return null
  return { token, expiryMs: Number(expiryRaw) }
}

/**
 * Clear the persisted Google access token on sign-out.
 */
export function clearPersistedGoogleToken(): void {
  getStorageProvider().removeMeta("googleAuth/accessToken").catch(console.error)
  getStorageProvider().removeMeta("googleAuth/tokenExpiry").catch(console.error)
}

// ── Zustand storage adapter ───────────────────────────────────────────────────

/**
 * Create a Zustand PersistStorage adapter backed by IndexedDB.
 * Skips identical writes: breaks cross-tab rehydrate→write→broadcast loops.
 */
export function createZustandStorage<T>(): PersistStorage<T> {
  let last: string | null = null
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

    setItem: async (key, value) => {
      try {
        const serialized = JSON.stringify(value)
        if (serialized === last) return
        last = serialized
        await getStorageProvider().setItem(key, serialized)
        announceWrite()
      } catch (error) {
        console.error("Failed to set item in storage:", error)
      }
    },

    removeItem: async (key) => {
      last = null
      await getStorageProvider().removeItem(key).catch((e) => console.error("Failed to remove item from storage:", e))
    },
  }
}
