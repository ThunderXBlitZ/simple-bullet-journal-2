/**
 * Zustand storage adapter for our custom StorageProvider
 */

import type { PersistStorage, StorageValue } from "zustand/middleware"
import type { StorageProvider } from "./storage"

/**
 * Create a Zustand-compatible storage object from our StorageProvider
 */
export function createZustandStorage<T>(provider: StorageProvider): PersistStorage<T> {
  return {
    getItem: async (key: string) => {
      try {
        const value = await provider.getItem(key)
        return value ? JSON.parse(value) : null
      } catch (error) {
        console.error("Failed to get item from storage:", error)
        return null
      }
    },
    setItem: async (key: string, value: StorageValue<T>) => {
      try {
        await provider.setItem(key, JSON.stringify(value))
      } catch (error) {
        console.error("Failed to set item in storage:", error)
      }
    },
    removeItem: async (key: string) => {
      try {
        await provider.removeItem(key)
      } catch (error) {
        console.error("Failed to remove item from storage:", error)
      }
    },
  }
}
