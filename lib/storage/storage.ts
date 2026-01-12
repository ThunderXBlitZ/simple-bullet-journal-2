/**
 * Storage abstraction layer for persisting journal data
 */

export interface StorageProvider {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}

/**
 * IndexedDB implementation of StorageProvider
 */
export class IndexedDBStorage implements StorageProvider {
  private dbName = "BulletJournalDB"
  private storeName = "data"
  private dbPromise: Promise<IDBDatabase> | null = null

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName)
        }
      }
    })

    return this.dbPromise
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readonly")
        const store = transaction.objectStore(this.storeName)
        const request = store.get(key)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result || null)
      })
    } catch (error) {
      console.error("IndexedDB getItem error:", error)
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite")
        const store = transaction.objectStore(this.storeName)
        const request = store.put(value, key)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (error) {
      console.error("IndexedDB setItem error:", error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite")
        const store = transaction.objectStore(this.storeName)
        const request = store.delete(key)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (error) {
      console.error("IndexedDB removeItem error:", error)
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB()
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite")
        const store = transaction.objectStore(this.storeName)
        const request = store.clear()

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      })
    } catch (error) {
      console.error("IndexedDB clear error:", error)
    }
  }
}

/**
 * LocalStorage implementation of StorageProvider (fallback)
 */
export class LocalStorageProvider implements StorageProvider {
  async getItem(key: string): Promise<string | null> {
    try {
      return typeof window !== "undefined" ? localStorage.getItem(key) : null
    } catch (error) {
      console.error("LocalStorage getItem error:", error)
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, value)
      }
    } catch (error) {
      console.error("LocalStorage setItem error:", error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.error("LocalStorage removeItem error:", error)
    }
  }

  async clear(): Promise<void> {
    try {
      if (typeof window !== "undefined") {
        localStorage.clear()
      }
    } catch (error) {
      console.error("LocalStorage clear error:", error)
    }
  }
}

/**
 * Get the appropriate storage provider
 * Tries IndexedDB first, falls back to localStorage
 */
export function getStorageProvider(): StorageProvider {
  if (typeof window !== "undefined" && "indexedDB" in window) {
    return new IndexedDBStorage()
  }
  return new LocalStorageProvider()
}
