/**
 * Zustand storage adapter for our custom StorageProvider
 */

import type { PersistStorage, StorageValue } from "zustand/middleware"
import type { StorageProvider } from "./storage"

/**
 * Module-level active storage key for per-user namespacing
 * When set, all storage operations use this key instead of the default
 * Fallback to original key name enables migration for existing users
 */
let activeKey: string | null = null

/**
 * Set the active storage key and persist to localStorage
 * Call this before any store writes (e.g., during auth flow)
 */
export function setActiveStorageKey(key: string): void {
  activeKey = key
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("bj-active-user-key", key)
  }
}

/**
 * Clear the active storage key and remove pointer from localStorage
 * Call this on logout
 */
export function clearActiveStorageKey(): void {
  activeKey = null
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("bj-active-user-key")
  }
}

/**
 * Get the persisted active key from localStorage
 * Used on app startup to restore the previous user's context
 */
export function getPersistedActiveKey(): string | null {
  if (typeof localStorage === "undefined") {
    return null
  }
  return localStorage.getItem("bj-active-user-key")
}

/**
 * Permanently save the guest's UUID so they can restore their account after logout.
 * Unlike the active-user-key, this is NOT cleared on logout.
 */
export function persistGuestId(id: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("bj-guest-id", id)
  }
}

/**
 * Read the persisted guest UUID. Returns null if user has never been a guest
 * or has migrated to Google (clearPersistedGuestId was called).
 */
export function getPersistedGuestId(): string | null {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem("bj-guest-id")
}

/**
 * Clear the persisted guest UUID. Call this when a guest migrates to Google
 * so they no longer fall back to the guest account on startup.
 */
export function clearPersistedGuestId(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("bj-guest-id")
  }
}

/**
 * Create a Zustand-compatible storage object from our StorageProvider
 */
export function createZustandStorage<T>(provider: StorageProvider): PersistStorage<T> {
  return {
    getItem: async (key: string) => {
      try {
        const finalKey = activeKey ?? key
        const value = await provider.getItem(finalKey)
        return value ? JSON.parse(value) : null
      } catch (error) {
        console.error("Failed to get item from storage:", error)
        return null
      }
    },
    setItem: async (key: string, value: StorageValue<T>) => {
      try {
        const finalKey = activeKey ?? key
        await provider.setItem(finalKey, JSON.stringify(value))
      } catch (error) {
        console.error("Failed to set item in storage:", error)
      }
    },
    removeItem: async (key: string) => {
      try {
        const finalKey = activeKey ?? key
        await provider.removeItem(finalKey)
      } catch (error) {
        console.error("Failed to remove item from storage:", error)
      }
    },
  }
}
