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
import { getStorageProvider } from "./storage/storage"
import { createZustandStorage } from "./storage/zustand-adapter"
import { tagPresets } from "./tag-presets"

const generateId = () => Math.random().toString(36).substring(2, 15)

const getToday = () => new Date().toISOString().split("T")[0]

const initializePresetTags = (): Tag[] => {
  return tagPresets.map((preset) => ({
    ...preset,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }))
}

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
}

const statusCycle: BulletStatus[] = ["open", "complete", "migrated", "scheduled", "irrelevant"]

export const useJournalStore = create<JournalStore>()(
  persist(
    (set, get) => ({
      dailyLogs: {},
      tags: initializePresetTags(),
      habits: [],
      habitCompletions: [],
      collections: [],
      userName: "",
      settings: {
        showDots: true,
        showLines: false,
        focusMode: false,
        zoomLevel: 1,
      },

      getDailyLog: (date: string) => {
        const { dailyLogs } = get()
        return dailyLogs[date] || { date, entries: [] }
      },

      addEntry: (date, type, content, indent = 0, tagIds = [], title) => {
        const now = new Date().toISOString()
        const newEntry: BulletEntry = {
          id: generateId(),
          type,
          status: type === "task" ? "open" : "complete",
          title,
          content,
          indent,
          tagIds: tagIds.length > 0 ? tagIds : undefined,
          createdAt: now,
          updatedAt: now,
        }

        set((state) => {
          const existingLog = state.dailyLogs[date] || { date, entries: [] }
          return {
            dailyLogs: {
              ...state.dailyLogs,
              [date]: {
                ...existingLog,
                entries: [...existingLog.entries, newEntry],
              },
            },
          }
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
                  e.id === entryId ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e,
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
            dailyLogs: {
              ...state.dailyLogs,
              [date]: {
                ...log,
                entries: log.entries.filter((e) => e.id !== entryId),
              },
            },
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
                  return { ...e, status: nextStatus, updatedAt: new Date().toISOString() }
                }),
              },
            },
          }
        })
      },

      addTag: (name, color) => {
        const newTag: Tag = {
          id: generateId(),
          name,
          color,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          tags: [...state.tags, newTag],
        }))
      },

      deleteTag: (tagId) => {
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== tagId),
          dailyLogs: Object.fromEntries(
            Object.entries(state.dailyLogs).map(([date, log]) => [
              date,
              {
                ...log,
                entries: log.entries.map((e) => ({
                  ...e,
                  tagIds: e.tagIds?.filter((id) => id !== tagId),
                })),
              },
            ])
          ),
        }))
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
                    ? { ...e, tagIds: [...(e.tagIds || []), tagId] }
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
                    ? { ...e, tagIds: e.tagIds?.filter((id) => id !== tagId) }
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
        const newHabit: Habit = {
          id: generateId(),
          name,
          icon,
          color,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ habits: [...state.habits, newHabit] }))
      },

      deleteHabit: (habitId) => {
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== habitId),
          habitCompletions: state.habitCompletions.filter((c) => c.habitId !== habitId),
        }))
      },

      toggleHabitCompletion: (habitId, date) => {
        set((state) => {
          const existing = state.habitCompletions.find((c) => c.habitId === habitId && c.date === date)

          if (existing) {
            return {
              habitCompletions: state.habitCompletions.map((c) =>
                c.habitId === habitId && c.date === date ? { ...c, completed: !c.completed } : c,
              ),
            }
          }

          return {
            habitCompletions: [...state.habitCompletions, { habitId, date, completed: true }],
          }
        })
      },

      getHabitStreak: (habitId) => {
        const { habitCompletions } = get()
        const completions = habitCompletions
          .filter((c) => c.habitId === habitId && c.completed)
          .map((c) => c.date)
          .sort()
          .reverse()

        if (completions.length === 0) return 0

        let streak = 0
        const today = new Date()

        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(today)
          checkDate.setDate(today.getDate() - i)
          const dateStr = checkDate.toISOString().split("T")[0]

          if (completions.includes(dateStr)) {
            streak++
          } else if (i > 0) {
            break
          }
        }

        return streak
      },

      addCollection: (name, icon) => {
        const newCollection: Collection = {
          id: generateId(),
          name,
          icon,
          items: [],
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ collections: [...state.collections, newCollection] }))
      },

      deleteCollection: (collectionId) => {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== collectionId),
        }))
      },

      addCollectionItem: (collectionId, content) => {
        const newItem: CollectionItem = {
          id: generateId(),
          content,
          completed: false,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId ? { ...c, items: [...c.items, newItem] } : c,
          ),
        }))
      },

      toggleCollectionItem: (collectionId, itemId) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  items: c.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i)),
                }
              : c,
          ),
        }))
      },

      deleteCollectionItem: (collectionId, itemId) => {
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c,
          ),
        }))
      },

      migrateIncompleteTasks: (fromDate, toDate) => {
        set((state) => {
          const fromLog = state.dailyLogs[fromDate]
          if (!fromLog) return state

          const incompleteTasks = fromLog.entries.filter((e) => e.type === "task" && e.status === "open")

          if (incompleteTasks.length === 0) return state

          const toLog = state.dailyLogs[toDate] || { date: toDate, entries: [] }
          const now = new Date().toISOString()

          const migratedEntries = incompleteTasks.map((e) => ({
            ...e,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          }))

          return {
            dailyLogs: {
              ...state.dailyLogs,
              [fromDate]: {
                ...fromLog,
                entries: fromLog.entries.map((e) =>
                  incompleteTasks.find((t) => t.id === e.id) ? { ...e, status: "migrated" as BulletStatus } : e,
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

          const entries = [...log.entries]
          const [movedEntry] = entries.splice(fromIndex, 1)
          entries.splice(toIndex, 0, movedEntry)

          return {
            dailyLogs: {
              ...state.dailyLogs,
              [date]: { ...log, entries },
            },
          }
        })
      },

      reorderHabits: (fromIndex, toIndex) => {
        set((state) => {
          if (fromIndex === toIndex) return state

          const habits = [...state.habits]
          const [movedHabit] = habits.splice(fromIndex, 1)
          habits.splice(toIndex, 0, movedHabit)

          return { habits }
        })
      },

      reorderCollectionItems: (collectionId, fromIndex, toIndex) => {
        set((state) => {
          const collection = state.collections.find((c) => c.id === collectionId)
          if (!collection || fromIndex === toIndex) return state

          const items = [...collection.items]
          const [movedItem] = items.splice(fromIndex, 1)
          items.splice(toIndex, 0, movedItem)

          return {
            collections: state.collections.map((c) => (c.id === collectionId ? { ...c, items } : c)),
          }
        })
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

      setUserName: (name) => {
        set({ userName: name.trim() })
      },
    }),
    {
      name: "bullet-journal-storage",
      storage: createZustandStorage(getStorageProvider()),
    },
  ),
)
