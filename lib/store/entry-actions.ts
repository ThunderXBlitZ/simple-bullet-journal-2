import type { BulletEntry, BulletStatus } from "../types"
import { newId, nowIso, nextOrder, addTombstones, moveItem, reindex } from "../journal-helpers"
import type { Slice } from "./types"

const statusCycle: BulletStatus[] = ["open", "complete", "migrated", "scheduled", "irrelevant"]

export const entryActions: Slice<
  | "getDailyLog" | "addEntry" | "updateEntry" | "deleteEntry" | "cycleStatus" | "moveEntry"
  | "addTagToEntry" | "removeTagFromEntry" | "migrateIncompleteTasks" | "reorderEntries"
> = (set, get) => ({
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
                  if (e.id !== entryId || e.type !== "task") return e
                  const currentIndex = statusCycle.indexOf(e.status)
                  const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length]
                  return { ...e, status: nextStatus, updatedAt: nowIso() }
                }),
              },
            },
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

      moveEntry: (fromDate, toDate, entryId) => {
        set((state) => {
          const from = state.dailyLogs[fromDate]
          const entry = from?.entries.find((e) => e.id === entryId)
          if (!from || !entry || fromDate === toDate) return state
          const to = state.dailyLogs[toDate] || { date: toDate, entries: [] }
          // Entries merge per-date by id, so a plain move would duplicate on another device.
          // New id + tombstone for the old one makes the move a delete + create.
          const moved: BulletEntry = { ...entry, id: newId(), order: nextOrder(to.entries), updatedAt: nowIso() }
          return {
            dailyLogs: {
              ...state.dailyLogs,
              [fromDate]: { ...from, entries: reindex(from.entries.filter((e) => e.id !== entryId)) },
              [toDate]: { ...to, entries: [...to.entries, moved] },
            },
            tombstones: addTombstones(state.tombstones, [entryId]),
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
})
