import { z } from "zod"

/** Zod schema for the syncable journal data. Pure: shared by backup import, Drive parse, and scripts. Keep in step with lib/types.ts. */
export const iso = z.string().datetime()
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
