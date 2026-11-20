import { newId, nowIso, nextOrder, addTombstones, moveItem, reindex } from "../journal-helpers"
import type { Slice } from "./types"

export const habitCollectionActions: Slice<
  | "addHabit" | "updateHabit" | "deleteHabit" | "toggleHabitCompletion" | "reorderHabits"
  | "addCollection" | "deleteCollection" | "addCollectionItem" | "toggleCollectionItem" | "deleteCollectionItem"
  | "reorderCollectionItems" | "reorderCollections"
> = (set, get) => ({
      addHabit: (name, icon, color, date) => {
        const now = nowIso()
        set((state) => ({
          habits: [
            ...state.habits,
            { id: newId(), name, icon, color, ...(date ? { date } : {}), order: nextOrder(state.habits), createdAt: now, updatedAt: now },
          ],
        }))
      },

      updateHabit: (habitId, { name, icon, color, date }) => {
        const now = nowIso()
        set((state) => ({
          habits: state.habits.map((h) => {
            if (h.id !== habitId) return h
            const { date: _old, ...rest } = h
            return { ...rest, name, icon, color, ...(date ? { date } : {}), updatedAt: now }
          }),
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

      addCollection: (name, icon) => {
        const now = nowIso()
        set((state) => ({
          collections: [...state.collections, { id: newId(), name, icon, items: [], order: nextOrder(state.collections), createdAt: now, updatedAt: now }],
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

      reorderHabits: (fromIndex, toIndex) => {
        set((state) => (fromIndex === toIndex ? state : { habits: reindex(moveItem(state.habits, fromIndex, toIndex)) }))
      },

      reorderCollections: (fromIndex, toIndex) => {
        set((state) =>
          fromIndex === toIndex ? state : { collections: reindex(moveItem(state.collections, fromIndex, toIndex)) },
        )
      },
})
