import { z } from "zod"
import { iso, journalDataSchema } from "./schema"
import { useJournalStore } from "./journal-store"
import { pickJournalData, type JournalData } from "./journal-data"
import { mergeJournals } from "./sync/merge"
import { localDateStr, nowIso } from "./journal-helpers"

const backupSchema = z.object({ app: z.literal("bullet-journal"), schema: z.literal(2), exportedAt: iso, data: journalDataSchema })

export const exportBackup = (): string =>
  JSON.stringify({ app: "bullet-journal", schema: 2, exportedAt: new Date().toISOString(), data: pickJournalData(useJournalStore.getState()) }, null, 2)

export function downloadBackup(): void {
  const url = URL.createObjectURL(new Blob([exportBackup()], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `bullet-journal-${localDateStr()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000) // Safari cancels the download if revoked synchronously
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

/** Real journals are well under 1 MB; this just stops a huge file freezing the tab. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024
export const TOO_BIG = "That file is too large to be a Bullet Journal backup (limit 10 MB)."

/** Throws a user-readable Error if the file isn't a valid backup; state is untouched on failure. */
export function importBackup(json: string, mode: "merge" | "replace"): void {
  if (json.length > MAX_IMPORT_BYTES) throw new Error(TOO_BIG)
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error("That file isn't valid JSON.") }
  const result = backupSchema.safeParse(parsed)
  if (!result.success) throw new Error("That file isn't a Bullet Journal backup (or is from an incompatible version).")
  const incoming = result.data.data as JournalData
  const local = pickJournalData(useJournalStore.getState())
  const next = mode === "replace" ? withDroppedTombstones(local, incoming) : mergeJournals(local, incoming)
  useJournalStore.setState(next)
}
