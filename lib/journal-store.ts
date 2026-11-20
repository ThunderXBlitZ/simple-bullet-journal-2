"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Collection } from "./types"
import { createZustandStorage } from "./storage/zustand-adapter"
import { newId, nowIso, addTombstones, initializePresetTags } from "./journal-helpers"
import type { JournalStore } from "./store/types"
import { entryActions } from "./store/entry-actions"
import { habitCollectionActions } from "./store/habit-collection-actions"

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
    (set, get, api) => ({
      ...initialState(),
      ...entryActions(set, get, api),
      ...habitCollectionActions(set, get, api),

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

      getTagById: (tagId) => {
        const { tags } = get()
        return tags.find((t) => t.id === tagId)
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
      version: 3,
      migrate: (persisted: unknown) => {
        const s = persisted as { collections?: Collection[] }
        if (s?.collections) s.collections = s.collections.map((c, i) => (typeof c.order === "number" ? c : { ...c, order: i }))
        return s as JournalStore
      },
      storage: createZustandStorage(),
      skipHydration: true,
    },
  ),
)