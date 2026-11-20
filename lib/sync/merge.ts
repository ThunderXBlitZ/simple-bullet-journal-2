import type { JournalData } from "../journal-data"
import type { BulletEntry, Collection, DailyLog, Tag, Tombstones } from "../types"

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

interface Rec { id: string; updatedAt: string }
interface Ordered extends Rec { order: number; createdAt: string }

/** Newest updatedAt wins; exact ties break on content so merge stays commutative. */
function pick<T extends { updatedAt: string }>(a: T, b: T): T {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt > a.updatedAt ? b : a
  return JSON.stringify(b) > JSON.stringify(a) ? b : a
}

function mergeById<T extends Rec>(a: T[], b: T[]): Map<string, T> {
  const out = new Map<string, T>()
  for (const r of [...a, ...b]) {
    const cur = out.get(r.id)
    out.set(r.id, cur ? pick(cur, r) : r)
  }
  return out
}

/** A record is dead if a tombstone is at least as new as its last update (edit-after-delete resurrects). */
function live<T extends Rec>(m: Map<string, T>, t: Tombstones): T[] {
  return [...m.values()].filter((r) => !(r.id in t && t[r.id] >= r.updatedAt))
}

const byOrder = <T extends Ordered>(list: T[]): T[] =>
  list.sort((x, y) => x.order - y.order || x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id))

/** Collapse tags that share a name (case-insensitive): keep the earliest, remap the rest. */
function canonicalTags(tags: Tag[]): { tags: Tag[]; remap: Map<string, string> } {
  const sorted = [...tags].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id))
  const keep = new Map<string, Tag>()
  const remap = new Map<string, string>()
  for (const t of sorted) {
    const k = t.name.trim().toLowerCase()
    const first = keep.get(k)
    if (!first) keep.set(k, t)
    else remap.set(t.id, first.id)
  }
  return { tags: [...keep.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id)), remap }
}

export function mergeJournals(a: JournalData, b: JournalData, now: number = Date.now()): JournalData {
  const tombstones: Tombstones = {}
  for (const [id, at] of [...Object.entries(a.tombstones), ...Object.entries(b.tombstones)]) {
    if (now - Date.parse(at) > TOMBSTONE_TTL_MS) continue
    if (!(id in tombstones) || at > tombstones[id]) tombstones[id] = at
  }

  const { tags, remap } = canonicalTags(live(mergeById(a.tags, b.tags), tombstones))
  const tagIds = new Set(tags.map((t) => t.id))
  const fixTags = (e: BulletEntry): BulletEntry => {
    if (!e.tagIds) return e
    const ids = [...new Set(e.tagIds.map((id) => remap.get(id) ?? id).filter((id) => tagIds.has(id)))]
    return { ...e, tagIds: ids.length ? ids : undefined }
  }

  const dailyLogs: Record<string, DailyLog> = {}
  for (const date of new Set([...Object.keys(a.dailyLogs), ...Object.keys(b.dailyLogs)])) {
    const entries = byOrder(live(mergeById(a.dailyLogs[date]?.entries ?? [], b.dailyLogs[date]?.entries ?? []), tombstones)).map(fixTags)
    if (entries.length) dailyLogs[date] = { date, entries }
  }

  const habits = byOrder(live(mergeById(a.habits, b.habits), tombstones))
  const habitIds = new Set(habits.map((h) => h.id))

  const completions = new Map<string, (typeof a.habitCompletions)[number]>()
  for (const c of [...a.habitCompletions, ...b.habitCompletions]) {
    const k = `${c.habitId}|${c.date}`
    const cur = completions.get(k)
    completions.set(k, cur ? pick(cur, c) : c)
  }
  const habitCompletions = [...completions.values()]
    .filter((c) => habitIds.has(c.habitId))
    .sort((x, y) => x.date.localeCompare(y.date) || x.habitId.localeCompare(y.habitId))

  const colA = new Map(a.collections.map((c) => [c.id, c]))
  const colB = new Map(b.collections.map((c) => [c.id, c]))
  const collections: Collection[] = live(mergeById(a.collections, b.collections), tombstones)
    .map((c) => ({
      ...c,
      items: byOrder(live(mergeById(colA.get(c.id)?.items ?? [], colB.get(c.id)?.items ?? []), tombstones)),
    }))
    .sort((x, y) => (x.order ?? 1e9) - (y.order ?? 1e9) || x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id))

  const nameWinner =
    a.userNameUpdatedAt !== b.userNameUpdatedAt
      ? b.userNameUpdatedAt > a.userNameUpdatedAt ? b : a
      : b.userName > a.userName ? b : a

  return {
    dailyLogs,
    tags,
    habits,
    habitCompletions,
    collections,
    userName: nameWinner.userName,
    userNameUpdatedAt: nameWinner.userNameUpdatedAt,
    tombstones,
  }
}
