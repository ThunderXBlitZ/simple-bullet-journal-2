import { format } from "date-fns"
import { tagPresets } from "./tag-presets"
import type { Habit, HabitCompletion, Tag, Tombstones } from "./types"

export const EPOCH = "1970-01-01T00:00:00.000Z"

/** randomUUID needs a secure context; fall back so plain-http LAN testing doesn't crash. */
export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

export const nowIso = (): string => new Date().toISOString()

/** Local calendar date (NOT UTC) as YYYY-MM-DD. */
export const localDateStr = (d: Date = new Date()): string => format(d, "yyyy-MM-dd")

export const nextOrder = (list: { order: number }[]): number => list.reduce((m, r) => Math.max(m, r.order), -1) + 1

export function addTombstones(t: Tombstones, ids: string[]): Tombstones {
  const at = nowIso()
  const next = { ...t }
  for (const id of ids) next[id] = at
  return next
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Rewrites `order` to the array index; only changed records get a new updatedAt. */
export function reindex<T extends { order: number; updatedAt: string }>(list: T[]): T[] {
  const at = nowIso()
  return list.map((r, i) => (r.order === i ? r : { ...r, order: i, updatedAt: at }))
}

/** Deterministic ids so independent devices create the *same* preset tags (merge-safe). */
export const presetTagId = (name: string): string => `preset-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

export const initializePresetTags = (): Tag[] =>
  tagPresets.map((p) => ({ ...p, id: presetTagId(p.name), createdAt: EPOCH, updatedAt: EPOCH }))

/** One pass over completions → O(1) lookups. Build once per render (useMemo), not per habit/cell. */
export function completionIndex(completions: HabitCompletion[]) {
  const keys = new Set<string>()
  const perDate = new Map<string, number>()
  for (const c of completions) {
    if (!c.completed) continue
    keys.add(`${c.habitId}|${c.date}`)
    perDate.set(c.date, (perDate.get(c.date) ?? 0) + 1)
  }
  const isDone = (habitId: string, date: string): boolean => keys.has(`${habitId}|${date}`)
  return {
    isDone,
    doneOn: (date: string): number => perDate.get(date) ?? 0,
    streak(habitId: string, today: Date = new Date()): number {
      let streak = 0
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        if (isDone(habitId, localDateStr(d))) streak++
        else if (i > 0) break
      }
      return streak
    },
  }
}

/** Habits pinned to a specific date (undated habits are tracker-only and never returned). */
export const getHabitsForDate = (habits: Habit[], date: string): Habit[] => habits.filter((h) => h.date === date)
