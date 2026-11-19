import { format } from "date-fns"
import { tagPresets } from "./tag-presets"
import type { HabitCompletion, Tag, Tombstones } from "./types"

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

export function calcStreak(completions: HabitCompletion[], habitId: string, today: Date = new Date()): number {
  const done = new Set(completions.filter((c) => c.habitId === habitId && c.completed).map((c) => c.date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (done.has(localDateStr(d))) streak++
    else if (i > 0) break
  }
  return streak
}
