"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  JournalState,
  BulletEntry,
  DailyLog,
  Habit,
  Collection,
  CollectionItem,
  BulletType,
  BulletStatus,
  Tag,
} from "./types"
import { createZustandStorage } from "./storage/zustand-adapter"
import {
  newId,
  nowIso,
  nextOrder,
  addTombstones,
  moveItem,
  reindex,
  calcStreak,
  initializePresetTags,
} from "./journal-helpers"

interface JournalStore extends JournalState {
  // Daily Log Actions
  getDailyLog: (date: string) => DailyLog
  addEntry: (date: string, type: BulletType, content: string, indent?: number, tagIds?: string[], title?: string) => void
  updateEntry: (date: string, entryId: string, updates: Partial<BulletEntry>) => void
  deleteEntry: (date: string, entryId: string) => void
  cycleStatus: (date: string, entryId: string) => void

  // Tag Actions
  addTag: (name: string, color: string) => void
  deleteTag: (tagId: string) => void
  addTagToEntry: (date: string, entryId: string, tagId: string) => void
  removeTagFromEntry: (date: string, entryId: string, tagId: string) => void
  getTagById: (tagId: string) => Tag | undefined

  // Habit Actions
  addHabit: (name: string, icon: string, color: string) => void
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

  // Settings
  toggleSetting: (setting: keyof JournalState["settings"]) => void
  setZoom: (zoomLevel: number) => void
  setUserName: (name: string) => void
  resetStore: () => void

  // Sync
  setLinkedAccount: (accountId: string | null, email: string | null) => void
  resetJournalData: () => void
}

const statusCycle: BulletStatus[] = ["open", "complete", "migrated", "scheduled", "irrelevant"]

const initialState = () => ({
  dailyLogs: {},
  tags: initializePresetTags(),
  habits: [],
  habitCompletions: [],
  collections: [],
  userName: "",
  userNameUpdatedAt: "1970-01-01T00:00:00.000Z",
  tombstones: {},
  settings: { showDots: true, showLines: false, focusMode: false, zoomLevel: 1 },
  googleEmail: null as string | null,
  syncAccountId: null as string | null,
})

export const useJournalStore = create<JournalStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      getDailyLog: (date: string) => {
        const { dailyLogs } = get()
        return dailyLogs[date] || { date, entries: [] }
      },

      addEntry: (date, type, content, indent = 0, tagIds = [], title) => {
        const now = nowIso()
        set((state) => {
          const log = state.dailyLogs[date] || { date, entries: [] }
          const entry: BulletEntry = {
            id: newId(), type, status: type === "task" ? "open" : "complete", title, content, indent,
            tagIds: tagIds.length > 0 ? tagIds : undefined, order: nextOrder(log.entries), createdAt: now, updatedAt: now,
          }
          return { dailyLogs: { ...state.dailyLogs, [date]: { ...log, entries: [...log.entries, entry] } } }
        })
      },

      updateEntry: (date, entryId, updates) => {
        set((state) => {
          const log = state.dailyLogs[date]
          if (!log) return state
          return {
            dailyLogs: {
              ...state.dailyLogs,
              [date]: {
                ...log,
                entries: log.entries.map((e) =>
                  e.id === entryId ? { ...e, ...updates, updatedAt: nowIso() } : e,
                ),
              },
            },
          }
        })
      },

      deleteEntry: (date, entryId) => {
        set((state) => {
          const log = state.dailyLogs[date]
          if (!log) return state
          return {
            dailyLogs: { ...state.dailyLogs, [date]: { ...log, entries: log.entries.filter((e) => e.id !== entryId) } },
            tombstones: addTombstones(state.tombstones, [entryId]),
          }
        })
      },

      cycleStatus: (date, entryId) => {
        set((state) => {
          const log = state.dailyLogs[date]
          if (!log) return state
          return {
            dailyLogs: {
              ...state.dailyLogs,
              [date]: {
                ...log,
                entries: log.entries.map((e) => {
                  if (e.id !== entryId) return e
                  const currentIndex = statusCycle.indexOf(e.status)
                  const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length]
                  return { ...e, status: nextStatus, updatedAt: nowIso() }
                }),
              },
            },
          }
        })
      },

      addTag: (name, color) => {
        const now = nowIso()
        set((state) => ({
          tags: [...state.tags, { id: newId(), name, color, createdAt: now, updatedAt: now }],
        }))
      },

      deleteTag: (tagId) => {
        set((state) => {
          const at = nowIso()
          return {
            tags: state.tags.filter((t) => t.id !== tagId),
            tombstones: addTombstones(state.tombstones, [tagId]),
            dailyLogs: Object.fromEntries(
              Object.entries(state.dailyLogs).map(([date, log]) => [
                date,
                { ...log, entries: log.entries.map((e) => (e.tagIds?.includes(tagId) ? { ...e, tagIds: e.tagIds.filter((id) => id !== tagId), updatedAt: at } : e)) },
              ]),
            ),
          }
        })
      },

      addTagToEntry: (date, entryId, tagId) => {
        set((state) => {
          const log = state.dailyLogs[date]
          if (!log) return state
          return {
            dailyLogs: {
              ...state.dailyLogs,
              [date]: {
                ...log,
                entries: log.entries.map((e) =>
                  e.id === entryId
                    ? { ...e, tagIds: [...(e.tagIds || []), tagId], updatedAt: nowIso() }
                    : e
                ),
              },
            },
          }
        })
      },

      removeTagFromEntry: (date, entryId, tagId) => {
        set((state) => {
          const log = state.dailyLogs[date]
          if (!log) return state
          return {
            dailyLogs: {
              ...state.dailyLogs,
              [date]: {
                ...log,
                entries: log.entries.map((e) =>
                  e.id === entryId
                    ? { ...e, tagIds: e.tagIds?.filter((id) => id !== tagId), updatedAt: nowIso() }
                    : e
                ),
              },
            },
          }
        })
      },

      getTagById: (tagId) => {
        const { tags } = get()
        return tags.find((t) => t.id === tagId)
      },

      addHabit: (name, icon, color) => {
        const now = nowIso()
        set((state) => ({
          habits: [...state.habits, { id: newId(), name, icon, color, order: nextOrder(state.habits), createdAt: now, updatedAt: now }],
        }))
      },

      deleteHabit: (habitId) => {
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== habitId),
          habitCompletions: state.habitCompletions.filter((c) => c.habitId !== habitId),
          tombstones: addTombstones(state.tombstones, [habitId]),
        }))
      },

      toggleHabitCompletion: (habitId, date) => {
        set((state) => {
          const updatedAt = nowIso()
          const existing = state.habitCompletions.find((c) => c.habitId === habitId && c.date === date)
          return {
            habitCompletions: existing
              ? state.habitCompletions.map((c) => (c === existing ? { ...c, completed: !c.completed, updatedAt } : c))
              : [...state.habitCompletions, { habitId, date, completed: true, updatedAt }],
          }
        })
      },

      getHabitStreak: (habitId) => calcStreak(get().habitCompletions, habitId),

      addCollection: (name, icon) => {
        const now = nowIso()
        set((state) => ({
          collections: [...state.collections, { id: newId(), name, icon, items: [], createdAt: now, updatedAt: now }],
        }))
      },

      deleteCollection: (collectionId) => {
        set((state) => {
          const col = state.collections.find((c) => c.id === collectionId)
          return {
            collections: state.collections.filter((c) => c.id !== collectionId),
            tombstones: addTombstones(state.tombstones, [collectionId, ...(col?.items.map((i) => i.id) ?? [])]),
          }
        })
      },

      addCollectionItem: (collectionId, content) => {
        const now = nowIso()
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  items: [...c.items, { id: newId(), content, completed: false, order: nextOrder(c.items), createdAt: now, updatedAt: now }],
                  updatedAt: now,
                }
              : c,
          ),
        }))
      },

      toggleCollectionItem: (collectionId, itemId) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  items: c.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed, updatedAt: nowIso() } : i)),
                }
              : c,
          ),
        }))
      },

      deleteCollectionItem: (collectionId, itemId) => {
        set((state) => ({
          collections: state.collections.map((c) => (c.id === collectionId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c)),
          tombstones: addTombstones(state.tombstones, [itemId]),
        }))
      },

      reorderCollectionItems: (collectionId, fromIndex, toIndex) => {
        set((state) => {
          const col = state.collections.find((c) => c.id === collectionId)
          if (!col || fromIndex === toIndex) return state
          const items = reindex(moveItem(col.items, fromIndex, toIndex))
          return { collections: state.collections.map((c) => (c.id === collectionId ? { ...c, items } : c)) }
        })
      },

      migrateIncompleteTasks: (fromDate, toDate) => {
        set((state) => {
          const fromLog = state.dailyLogs[fromDate]
          if (!fromLog) return state

          const incompleteTasks = fromLog.entries.filter((e) => e.type === "task" && e.status === "open")
          if (incompleteTasks.length === 0) return state

          const toLog = state.dailyLogs[toDate] || { date: toDate, entries: [] }
          const now = nowIso()

          const migratedEntries = incompleteTasks.map((e, i) => ({
            ...e,
            id: newId(),
            order: nextOrder(toLog.entries) + i,
            createdAt: now,
            updatedAt: now,
          }))

          return {
            dailyLogs: {
              ...state.dailyLogs,
              [fromDate]: {
                ...fromLog,
                entries: fromLog.entries.map((e) =>
                  incompleteTasks.find((t) => t.id === e.id) ? { ...e, status: "migrated" as BulletStatus, updatedAt: now } : e,
                ),
              },
              [toDate]: {
                ...toLog,
                entries: [...toLog.entries, ...migratedEntries],
              },
            },
          }
        })
      },

      reorderEntries: (date, fromIndex, toIndex) => {
        set((state) => {
          const log = state.dailyLogs[date]
          if (!log || fromIndex === toIndex) return state
          return { dailyLogs: { ...state.dailyLogs, [date]: { ...log, entries: reindex(moveItem(log.entries, fromIndex, toIndex)) } } }
        })
      },

      reorderHabits: (fromIndex, toIndex) => {
        set((state) => (fromIndex === toIndex ? state : { habits: reindex(moveItem(state.habits, fromIndex, toIndex)) }))
      },

      toggleSetting: (setting) => {
        set((state) => ({
          settings: {
            ...state.settings,
            [setting]: !state.settings[setting],
          },
        }))
      },

      setZoom: (zoomLevel) => {
        set((state) => ({
          settings: {
            ...state.settings,
            zoomLevel: Math.max(0.8, Math.min(1.5, zoomLevel)),
          },
        }))
      },

      setUserName: (name) => set({ userName: name.trim(), userNameUpdatedAt: nowIso() }),

      resetStore: () => set(initialState()),

      setLinkedAccount: (accountId, email) => set({ syncAccountId: accountId, googleEmail: email }),

      resetJournalData: () =>
        set({
          dailyLogs: {},
          tags: initializePresetTags(),
          habits: [],
          habitCompletions: [],
          collections: [],
          userName: "",
          userNameUpdatedAt: "1970-01-01T00:00:00.000Z",
          tombstones: {},
        }),
    }),
    {
      name: "bj-journal",
      version: 2,
      storage: createZustandStorage(),
      skipHydration: true,
    },
  ),
)
