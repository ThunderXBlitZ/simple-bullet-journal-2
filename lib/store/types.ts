import type { StateCreator } from "zustand"
import type { JournalState, BulletEntry, DailyLog, BulletType, Tag } from "../types"

export interface JournalStore extends JournalState {
  // Daily Log Actions
  getDailyLog: (date: string) => DailyLog
  addEntry: (date: string, type: BulletType, content: string, indent?: number, tagIds?: string[], title?: string) => void
  updateEntry: (date: string, entryId: string, updates: Partial<BulletEntry>) => void
  deleteEntry: (date: string, entryId: string) => void
  cycleStatus: (date: string, entryId: string) => void
  moveEntry: (fromDate: string, toDate: string, entryId: string) => void

  // Tag Actions
  addTag: (name: string, color: string) => void
  deleteTag: (tagId: string) => void
  addTagToEntry: (date: string, entryId: string, tagId: string) => void
  removeTagFromEntry: (date: string, entryId: string, tagId: string) => void
  getTagById: (tagId: string) => Tag | undefined

  // Habit Actions
  addHabit: (name: string, icon: string, color: string, date?: string) => void
  updateHabit: (habitId: string, patch: { name: string; icon: string; color: string; date?: string }) => void
  deleteHabit: (habitId: string) => void
  toggleHabitCompletion: (habitId: string, date: string) => void
  getHabitStreak: (habitId: string) => number

  // Collection Actions
  addCollection: (name: string, icon: string) => void
  deleteCollection: (collectionId: string) => void
  addCollectionItem: (collectionId: string, content: string) => void
  toggleCollectionItem: (collectionId: string, itemId: string) => void
  deleteCollectionItem: (collectionId: string, itemId: string) => void
  reorderCollectionItems: (collectionId: string, fromIndex: number, toIndex: number) => void

  // Migration
  migrateIncompleteTasks: (fromDate: string, toDate: string) => void

  // Reordering
  reorderEntries: (date: string, fromIndex: number, toIndex: number) => void
  reorderHabits: (fromIndex: number, toIndex: number) => void
  reorderCollections: (fromIndex: number, toIndex: number) => void

  // Settings
  toggleSetting: (setting: keyof JournalState["settings"]) => void
  setZoom: (zoomLevel: number) => void
  setUserName: (name: string) => void
  resetStore: () => void

  // Sync
  setLinkedAccount: (accountId: string | null, email: string | null) => void
  resetJournalData: () => void
}

/** A slice creator contributes a subset of JournalStore actions. */
export type Slice<K extends keyof JournalStore> = StateCreator<JournalStore, [], [], Pick<JournalStore, K>>
