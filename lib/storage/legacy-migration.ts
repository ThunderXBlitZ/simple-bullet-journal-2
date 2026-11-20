import { getStorageProvider } from "./storage"
import { emptyJournalData, type JournalData } from "../journal-data"
import { mergeJournals } from "../sync/merge"
import { EPOCH, nowIso } from "../journal-helpers"
import type { BulletEntry, Collection, CollectionItem, Habit, HabitCompletion, Tag } from "../types"

const isLegacyKey = (k: string) => k === "bullet-journal-storage" || k.startsWith("bj-guest-") || k.startsWith("bj-google-")

/** Pre-v2 persisted state: every field may be missing. */
export interface LegacyState {
  dailyLogs?: Record<string, { entries?: Partial<BulletEntry>[] }>
  tags?: Partial<Tag>[]
  habits?: Partial<Habit>[]
  habitCompletions?: Partial<HabitCompletion>[]
  collections?: (Partial<Omit<Collection, "items">> & { items?: Partial<CollectionItem>[] })[]
  userName?: string
  settings?: unknown
}

/** Fill fields that pre-v2 records lack. */
export function upgradeLegacyState(s: LegacyState): { data: JournalData; settings: unknown; entryCount: number } {
  const ts = (r: { updatedAt?: string; createdAt?: string }) => r.updatedAt ?? r.createdAt ?? EPOCH
  const logs: JournalData["dailyLogs"] = {}
  let entryCount = 0
  for (const [date, log] of Object.entries(s.dailyLogs ?? {})) {
    const entries: BulletEntry[] = (log.entries ?? []).map((e, i) => ({ ...e, order: e.order ?? i, updatedAt: ts(e), createdAt: e.createdAt ?? EPOCH }) as BulletEntry)
    entryCount += entries.length
    if (entries.length) logs[date] = { date, entries }
  }
  const data: JournalData = {
    ...emptyJournalData(),
    dailyLogs: logs,
    tags: (s.tags ?? []).map((t) => ({ ...t, createdAt: t.createdAt ?? EPOCH, updatedAt: ts(t) }) as Tag),
    habits: (s.habits ?? []).map((h, i) => ({ ...h, order: h.order ?? i, createdAt: h.createdAt ?? EPOCH, updatedAt: ts(h) }) as Habit),
    habitCompletions: (s.habitCompletions ?? []).map((c) => ({ ...c, updatedAt: c.updatedAt ?? EPOCH }) as HabitCompletion),
    collections: (s.collections ?? []).map((c, ci) => ({
      ...c,
      order: c.order ?? ci,
      createdAt: c.createdAt ?? EPOCH,
      updatedAt: ts(c),
      items: (c.items ?? []).map((it, i) => ({ ...it, order: it.order ?? i, createdAt: it.createdAt ?? EPOCH, updatedAt: ts(it) }) as CollectionItem),
    }) as Collection),
    userName: s.userName ?? "",
    userNameUpdatedAt: s.userName ? nowIso() : EPOCH,
  }
  return { data, settings: s.settings, entryCount }
}

/** One-time, non-destructive: merge every legacy store into `bj-journal`. Legacy keys are left in place. */
export async function migrateLegacyStores(): Promise<void> {
  const p = getStorageProvider()
  if ((await p.getMeta("schema")) === "2") return

  if (!(await p.getItem("bj-journal"))) {
    const found: ReturnType<typeof upgradeLegacyState>[] = []
    for (const key of (await p.listDataKeys()).filter(isLegacyKey)) {
      try {
        const raw = await p.getItem(key)
        const state = (raw ? JSON.parse(raw)?.state : null) as LegacyState | null
        if (state) found.push(upgradeLegacyState(state))
      } catch (e) {
        console.error(`Skipping unreadable legacy store ${key}`, e)
      }
    }
    if (found.length) {
      const merged = found.reduce((acc, f) => mergeJournals(acc, f.data), emptyJournalData())
      const richest = [...found].sort((a, b) => b.entryCount - a.entryCount)[0]
      const named = found.filter((f) => f.data.userName).sort((a, b) => b.entryCount - a.entryCount)[0]
      const state = {
        ...merged,
        userName: named?.data.userName ?? merged.userName,
        userNameUpdatedAt: named ? nowIso() : merged.userNameUpdatedAt,
        settings: richest.settings ?? { showDots: true, showLines: false, focusMode: false, zoomLevel: 1 },
        googleEmail: null,
        syncAccountId: null,
      }
      await p.setItem("bj-journal", JSON.stringify({ state, version: 2 }))
    }
  }
  await p.setMeta("schema", "2")
}
