/**
 * Auto-sync module for Google Drive
 * Debounced syncing of data to Google Drive when changes are made
 */

import { uploadToDrive } from './drive'
import { useJournalStore } from '@/lib/journal-store'

const DEBOUNCE_DELAY = 5000 // 5 seconds

let syncTimeout: NodeJS.Timeout | null = null
let isSyncing = false

/**
 * Debounced sync function
 * Delays sync operations to batch multiple changes together
 */
export function debouncedSync(): void {
  const store = useJournalStore.getState()

  // Check if sync is enabled and user is authenticated
  if (!store.googleDriveSyncEnabled || store.authMethod !== 'google' || !store.accessToken) {
    return
  }

  // Clear existing timeout
  if (syncTimeout) {
    clearTimeout(syncTimeout)
  }

  // Set new timeout
  syncTimeout = setTimeout(async () => {
    await performSync()
  }, DEBOUNCE_DELAY)
}

/**
 * Perform actual sync to Google Drive
 */
async function performSync(): Promise<void> {
  if (isSyncing) {
    return
  }

  const store = useJournalStore.getState()

  // Double check before syncing
  if (!store.googleDriveSyncEnabled || store.authMethod !== 'google' || !store.accessToken) {
    return
  }

  isSyncing = true

  try {
    const dataToSync = {
      dailyLogs: store.dailyLogs,
      tags: store.tags,
      habits: store.habits,
      habitCompletions: store.habitCompletions,
      collections: store.collections,
      userName: store.userName,
      settings: store.settings,
    }

    await uploadToDrive(JSON.stringify(dataToSync))

    // Update last sync time
    const now = new Date().toISOString()
    useJournalStore.setState({ lastSyncTime: now })

    console.log('Auto-sync completed')
  } catch (error) {
    console.error('Auto-sync failed:', error)
    // Don't show error toast for auto-sync, just log it
  } finally {
    isSyncing = false
  }
}

/**
 * Cancel any pending sync
 */
export function cancelSync(): void {
  if (syncTimeout) {
    clearTimeout(syncTimeout)
    syncTimeout = null
  }
}

/**
 * Force immediate sync (useful for manual sync button)
 */
export async function forceSync(): Promise<void> {
  cancelSync()
  await performSync()
}
