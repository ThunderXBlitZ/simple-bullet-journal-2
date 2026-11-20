import { z } from "zod"
import { useJournalStore } from "./journal-store"
import { pickJournalData, type JournalData } from "./journal-data"
import { mergeJournals } from "./sync/merge"
import { localDateStr, nowIso } from "./journal-helpers"

const iso = z.string().datetime()
const entry = z.object({
  id: z.string(), type: z.enum(["task", "event", "note"]),
  status: z.enum(["open", "complete", "migrated", "scheduled", "irrelevant"]),
  title: z.string().optional(), content: z.string(), indent: z.number(),
  tagIds: z.array(z.string()).optional(), order: z.number(), createdAt: iso, updatedAt: iso,
})
const item = z.object({ id: z.string(), content: z.string(), completed: z.boolean(), order: z.number(), createdAt: iso, updatedAt: iso })
export const journalDataSchema = z.object({
  dailyLogs: z.record(z.object({ date: z.string(), entries: z.array(entry) })),
  tags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), createdAt: iso, updatedAt: iso })),
  habits: z.array(z.object({ id: z.string(), name: z.string(), icon: z.string(), color: z.string(), date: z.string().optional(), order: z.number(), createdAt: iso, updatedAt: iso })),
  habitCompletions: z.array(z.object({ habitId: z.string(), date: z.string(), completed: z.boolean(), updatedAt: iso })),
  collections: z.array(z.object({ id: z.string(), name: z.string(), icon: z.string(), items: z.array(item), order: z.number().optional(), createdAt: iso, updatedAt: iso })),
  userName: z.string(), userNameUpdatedAt: iso, tombstones: z.record(iso),
})
const backupSchema = z.object({ app: z.literal("bullet-journal"), schema: z.literal(2), exportedAt: iso, data: journalDataSchema })

export const exportBackup = (): string =>
  JSON.stringify({ app: "bullet-journal", schema: 2, exportedAt: new Date().toISOString(), data: pickJournalData(useJournalStore.getState()) }, null, 2)

export function downloadBackup(): void {
  const url = URL.createObjectURL(new Blob([exportBackup()], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `bullet-journal-${localDateStr()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const recordIds = (d: JournalData): string[] => [
  ...Object.values(d.dailyLogs).flatMap((l) => l.entries.map((e) => e.id)),
  ...d.tags.map((t) => t.id),
  ...d.habits.map((h) => h.id),
  ...d.collections.flatMap((c) => [c.id, ...c.items.map((i) => i.id)]),
]

/** Replace must survive sync: tombstone every local record the backup lacks, or the next pull resurrects it. */
function withDroppedTombstones(local: JournalData, incoming: JournalData): JournalData {
  const keep = new Set(recordIds(incoming))
  const at = nowIso()
  const tombstones = { ...incoming.tombstones }
  for (const id of recordIds(local)) if (!keep.has(id)) tombstones[id] = at
  return { ...incoming, tombstones }
}

/** Throws a user-readable Error if the file isn't a valid backup; state is untouched on failure. */
export function importBackup(json: string, mode: "merge" | "replace"): void {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error("That file isn't valid JSON.") }
  const result = backupSchema.safeParse(parsed)
  if (!result.success) throw new Error("That file isn't a Bullet Journal backup (or is from an incompatible version).")
  const incoming = result.data.data as JournalData
  const local = pickJournalData(useJournalStore.getState())
  const next = mode === "replace" ? withDroppedTombstones(local, incoming) : mergeJournals(local, incoming)
  useJournalStore.setState(next)
}
