/**
 * Zustand storage adapter for our custom StorageProvider.
 * Also exposes helpers for reading/writing per-user metadata
 * (active storage key, guest ID) — all backed by IndexedDB, no localStorage.
 */

import type { PersistStorage, StorageValue } from "zustand/middleware"
import { getStorageProvider } from "./storage"

// ── Active key (in-memory routing) ──────────────────────────────────────────

/**
 * Module-level variable: which IndexedDB key to route all store reads/writes to.
 * Set before rehydrate / before any store.set() calls during auth.
 */
let activeKey: string | null = null

/**
 * Set the active storage key for the current user.
 * - Updates the in-memory router immediately (synchronous)
 * - Persists to IndexedDB "meta" store asynchronously (fire-and-forget)
 */
export function setActiveStorageKey(key: string): void {
  activeKey = key
  getStorageProvider().setMeta("activeUserKey", key).catch(console.error)
}

/**
 * Clear the active storage key on logout.
 * - Clears the in-memory router immediately
 * - Removes from IndexedDB "meta" store asynchronously
 */
export function clearActiveStorageKey(): void {
  activeKey = null
  getStorageProvider().removeMeta("activeUserKey").catch(console.error)
}

/**
 * Read the previously-active storage key from IndexedDB.
 * Called during app startup before rehydrate().
 */
export async function getPersistedActiveKey(): Promise<string | null> {
  return getStorageProvider().getMeta("activeUserKey")
}

// ── Guest ID (permanent identity) ────────────────────────────────────────────

/**
 * Permanently save the guest's UUID.
 * NOT cleared on logout — lets returning guests auto-restore their data.
 */
export function persistGuestId(id: string): void {
  getStorageProvider().setMeta("guestId", id).catch(console.error)
}

/**
 * Read the persisted guest UUID from IndexedDB.
 * Returns null if user has never been a guest or has migrated to Google.
 */
export async function getPersistedGuestId(): Promise<string | null> {
  return getStorageProvider().getMeta("guestId")
}

/**
 * Clear the guest UUID after a guest migrates to Google,
 * so they no longer fall back to the guest account on startup.
 */
export function clearPersistedGuestId(): void {
  getStorageProvider().removeMeta("guestId").catch(console.error)
}

// ── User registry ─────────────────────────────────────────────────────────────

/**
 * Register a user in the IndexedDB user registry.
 * Call after auth is established, before setUserName().
 */
export async function registerUser(
  userKey: string,
  displayName: string,
  authMethod: "guest" | "google",
): Promise<void> {
  return getStorageProvider().registerUser(userKey, displayName, authMethod)
}

// ── Zustand storage adapter ───────────────────────────────────────────────────

/**
 * Create a Zustand PersistStorage adapter backed by IndexedDB.
 * All reads/writes are routed through `activeKey` for per-user isolation.
 */
export function createZustandStorage<T>(): PersistStorage<T> {
  return {
    getItem: async (key: string) => {
      try {
        const finalKey = activeKey ?? key
        const value = await getStorageProvider().getItem(finalKey)
        return value ? (JSON.parse(value) as StorageValue<T>) : null
      } catch (error) {
        console.error("Failed to get item from storage:", error)
        return null
      }
    },

    setItem: async (key: string, value: StorageValue<T>) => {
      try {
        const finalKey = activeKey ?? key
        await getStorageProvider().setItem(finalKey, JSON.stringify(value))
      } catch (error) {
        console.error("Failed to set item in storage:", error)
      }
    },

    removeItem: async (key: string) => {
      try {
        const finalKey = activeKey ?? key
        await getStorageProvider().removeItem(finalKey)
      } catch (error) {
        console.error("Failed to remove item from storage:", error)
      }
    },
  }
}
