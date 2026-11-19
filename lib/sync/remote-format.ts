import type { JournalData } from "../journal-data"
import { journalDataSchema } from "../backup"
import { upgradeLegacyState } from "../storage/legacy-migration"

export class RemoteTooNewError extends Error {}
export class RemoteInvalidError extends Error {}

export const serializeRemote = (data: JournalData): string =>
  JSON.stringify({ app: "bullet-journal", schema: 2, updatedAt: new Date().toISOString(), data })

/** Accepts schema-2 files and the legacy (pre-M6) snapshot. Never returns partial data. */
export function parseRemote(text: string): JournalData {
  let obj: any
  try {
    obj = JSON.parse(text)
  } catch {
    throw new RemoteInvalidError("Drive file is not valid JSON")
  }
  if (obj?.app === "bullet-journal" && typeof obj.schema === "number") {
    if (obj.schema > 2) throw new RemoteTooNewError()
    const parsed = journalDataSchema.safeParse(obj.data)
    if (!parsed.success) throw new RemoteInvalidError("Drive file failed validation")
    return parsed.data as JournalData
  }
  if (obj && typeof obj === "object" && "dailyLogs" in obj) return upgradeLegacyState(obj).data
  throw new RemoteInvalidError("Drive file has an unknown format")
}
