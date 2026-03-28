/**
 * Storage abstraction layer for persisting journal data
 * Uses IndexedDB with two object stores:
 *   "data" — journal state, keyed by user storage key (bj-guest-{id}, bj-google-{id})
 *   "meta" — metadata: activeUserKey, guestId, user registry
 */

export interface StorageProvider {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
}

const DB_NAME = "BulletJournalDB"
const DB_VERSION = 2
const DATA_STORE = "data"
const META_STORE = "meta"

/**
 * Singleton IndexedDB instance — lazy-initialized on first use.
 * Because getStorageProvider() is called at module init time in journal-store.ts
 * (which runs during Next.js SSR where window is undefined), we must NOT open
 * IndexedDB at construction time. We open it lazily inside getDB() which is
 * only called from the async adapter methods — always client-side, after mount.
 */
class IndexedDBStorage implements StorageProvider {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(DATA_STORE)) {
          db.createObjectStore(DATA_STORE)
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE)
        }
      }
    })

    return this.dbPromise
  }

  private async withStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
      const req = fn(store)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result ?? null)
    })
  }

  // ── Data store (journal state) ──────────────────────────────────────

  async getItem(key: string): Promise<string | null> {
    try {
      return await this.withStore<string>(DATA_STORE, "readonly", (s) => s.get(key))
    } catch (error) {
      console.error("IndexedDB getItem error:", error)
      return null
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.withStore(DATA_STORE, "readwrite", (s) => s.put(value, key))
    } catch (error) {
      console.error("IndexedDB setItem error:", error)
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.withStore(DATA_STORE, "readwrite", (s) => s.delete(key))
    } catch (error) {
      console.error("IndexedDB removeItem error:", error)
    }
  }

  async clear(): Promise<void> {
    try {
      await this.withStore(DATA_STORE, "readwrite", (s) => s.clear())
    } catch (error) {
      console.error("IndexedDB clear error:", error)
    }
  }

  // ── Meta store (active key, guest ID, user registry) ─────────────────

  async getMeta(key: string): Promise<string | null> {
    try {
      return await this.withStore<string>(META_STORE, "readonly", (s) => s.get(key))
    } catch (error) {
      console.error("IndexedDB getMeta error:", error)
      return null
    }
  }

  async setMeta(key: string, value: string): Promise<void> {
    try {
      await this.withStore(META_STORE, "readwrite", (s) => s.put(value, key))
    } catch (error) {
      console.error("IndexedDB setMeta error:", error)
    }
  }

  async removeMeta(key: string): Promise<void> {
    try {
      await this.withStore(META_STORE, "readwrite", (s) => s.delete(key))
    } catch (error) {
      console.error("IndexedDB removeMeta error:", error)
    }
  }

  /** Save display name + auth method for a user key (e.g. "bj-guest-{id}") */
  async registerUser(userKey: string, displayName: string, authMethod: "guest" | "google"): Promise<void> {
    await this.setMeta(`user/${userKey}`, JSON.stringify({ displayName, authMethod }))
  }

  /** Look up a registered user by their storage key */
  async getUser(userKey: string): Promise<{ displayName: string; authMethod: "guest" | "google" } | null> {
    const raw = await this.getMeta(`user/${userKey}`)
    return raw ? JSON.parse(raw) : null
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _db: IndexedDBStorage | null = null

/**
 * Returns the singleton IndexedDBStorage instance.
 * Safe to call at module load time — the DB connection is opened lazily
 * inside each method, never at construction time.
 */
export function getStorageProvider(): IndexedDBStorage {
  if (!_db) _db = new IndexedDBStorage()
  return _db
}

// Re-export type for use in zustand-adapter
export type { IndexedDBStorage }
