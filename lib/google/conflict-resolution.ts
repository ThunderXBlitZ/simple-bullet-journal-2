/**
 * Conflict Resolution Module
 * Handles merging local guest data with existing Google Drive data
 */

import { downloadFromDrive } from './drive'
import { useJournalStore } from '@/lib/journal-store'

export type MergeStrategy = 'keep-both' | 'drive-only' | 'local-only'

export interface DataSummary {
  dailyLogsCount: number
  entriesCount: number
  tagsCount: number
  habitsCount: number
  collectionsCount: number
  userName: string
  hasData: boolean
}

export interface SyncConflict {
  localSummary: DataSummary
  driveSummary: DataSummary | null
  hasConflict: boolean
}

/**
 * Get summary of current local data
 */
export function getLocalDataSummary(): DataSummary {
  const state = useJournalStore.getState()

  const entriesCount = Object.values(state.dailyLogs).reduce((sum, log) => sum + log.entries.length, 0)
  const hasData = entriesCount > 0 || state.tags.length > 0 || state.habits.length > 0

  return {
    dailyLogsCount: Object.keys(state.dailyLogs).length,
    entriesCount,
    tagsCount: state.tags.length,
    habitsCount: state.habits.length,
    collectionsCount: state.collections.length,
    userName: state.userName,
    hasData,
  }
}

/**
 * Download and get summary of Drive data
 */
export async function getDriveDataSummary(): Promise<DataSummary | null> {
  try {
    const driveDataJson = await downloadFromDrive()
    if (!driveDataJson) {
      return null
    }

    const driveData = JSON.parse(driveDataJson)

    const entriesCount = Object.values(driveData.dailyLogs || {}).reduce(
      (sum: number, log: any) => sum + (log.entries?.length || 0),
      0
    )
    const hasData = entriesCount > 0 || driveData.tags?.length > 0 || driveData.habits?.length > 0

    return {
      dailyLogsCount: Object.keys(driveData.dailyLogs || {}).length,
      entriesCount,
      tagsCount: driveData.tags?.length || 0,
      habitsCount: driveData.habits?.length || 0,
      collectionsCount: driveData.collections?.length || 0,
      userName: driveData.userName || '',
      hasData,
    }
  } catch (error) {
    console.error('Failed to get Drive data summary:', error)
    return null
  }
}

/**
 * Check for sync conflicts and return summary
 */
export async function checkForConflicts(): Promise<SyncConflict> {
  const localSummary = getLocalDataSummary()
  const driveSummary = await getDriveDataSummary()

  const hasConflict = localSummary.hasData && driveSummary?.hasData

  return {
    localSummary,
    driveSummary,
    hasConflict,
  }
}

/**
 * Create a backup of current state for undo
 */
export function createStateBackup(): string {
  const state = useJournalStore.getState()
  return JSON.stringify({
    dailyLogs: state.dailyLogs,
    tags: state.tags,
    habits: state.habits,
    habitCompletions: state.habitCompletions,
    collections: state.collections,
    userName: state.userName,
    settings: state.settings,
  })
}

/**
 * Restore state from backup
 */
export function restoreStateFromBackup(backup: string): void {
  try {
    const data = JSON.parse(backup)
    useJournalStore.setState({
      dailyLogs: data.dailyLogs,
      tags: data.tags,
      habits: data.habits,
      habitCompletions: data.habitCompletions,
      collections: data.collections,
      userName: data.userName,
      settings: data.settings,
    })
  } catch (error) {
    console.error('Failed to restore backup:', error)
  }
}

/**
 * Apply merge strategy
 */
export async function applyMergeStrategy(strategy: MergeStrategy): Promise<void> {
  if (strategy === 'local-only') {
    // Keep local data as-is, no download needed
    return
  }

  if (strategy === 'drive-only') {
    // Download and replace local data
    const driveDataJson = await downloadFromDrive()
    if (driveDataJson) {
      const driveData = JSON.parse(driveDataJson)
      useJournalStore.setState({
        dailyLogs: driveData.dailyLogs || {},
        tags: driveData.tags || [],
        habits: driveData.habits || [],
        habitCompletions: driveData.habitCompletions || [],
        collections: driveData.collections || [],
        userName: driveData.userName || '',
        settings: driveData.settings || { showDots: true, showLines: false, focusMode: false, zoomLevel: 1 },
      })
    }
    return
  }

  if (strategy === 'keep-both') {
    // Merge: local + drive (Drive data overwrites conflicts, but we add missing local stuff)
    const driveDataJson = await downloadFromDrive()
    if (driveDataJson) {
      const driveData = JSON.parse(driveDataJson)
      const localState = useJournalStore.getState()

      // Merge daily logs (combine entries from both)
      const mergedDailyLogs = {
        ...driveData.dailyLogs,
        ...localState.dailyLogs,
      }

      // Merge tags (by ID, Drive wins on conflicts)
      const driveTagMap = new Map(driveData.tags?.map((t: any) => [t.id, t]) || [])
      const localTagMap = new Map(localState.tags.map((t) => [t.id, t]))
      driveTagMap.forEach((tag, id) => {
        localTagMap.delete(id)
      })
      const mergedTags = [...driveData.tags || [], ...Array.from(localTagMap.values())]

      // Merge habits (by ID, Drive wins on conflicts)
      const driveHabitMap = new Map(driveData.habits?.map((h: any) => [h.id, h]) || [])
      const localHabitMap = new Map(localState.habits.map((h) => [h.id, h]))
      driveHabitMap.forEach((habit, id) => {
        localHabitMap.delete(id)
      })
      const mergedHabits = [...driveData.habits || [], ...Array.from(localHabitMap.values())]

      // Merge habit completions (combine both)
      const mergedHabitCompletions = [
        ...(driveData.habitCompletions || []),
        ...localState.habitCompletions.filter(
          (lc) =>
            !(driveData.habitCompletions || []).some(
              (dc: any) => dc.habitId === lc.habitId && dc.date === lc.date
            )
        ),
      ]

      // Merge collections (by ID, Drive wins on conflicts)
      const driveCollectionMap = new Map(driveData.collections?.map((c: any) => [c.id, c]) || [])
      const localCollectionMap = new Map(localState.collections.map((c) => [c.id, c]))
      driveCollectionMap.forEach((col, id) => {
        localCollectionMap.delete(id)
      })
      const mergedCollections = [...driveData.collections || [], ...Array.from(localCollectionMap.values())]

      // Use Drive's userName if it exists, otherwise keep local
      const mergedUserName = driveData.userName || localState.userName

      useJournalStore.setState({
        dailyLogs: mergedDailyLogs,
        tags: mergedTags,
        habits: mergedHabits,
        habitCompletions: mergedHabitCompletions,
        collections: mergedCollections,
        userName: mergedUserName,
        settings: driveData.settings || localState.settings,
      })
    }
  }
}
