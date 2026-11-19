import type { Collection, DailyLog, Habit, HabitCompletion, Tag, Tombstones } from "./types"

/** The syncable/exportable subset of the journal. Settings are device-local and excluded. */
export interface JournalData {
  dailyLogs: Record<string, DailyLog>
  tags: Tag[]
  habits: Habit[]
  habitCompletions: HabitCompletion[]
  collections: Collection[]
  userName: string
  userNameUpdatedAt: string
  tombstones: Tombstones
}

export const emptyJournalData = (): JournalData => ({
  dailyLogs: {},
  tags: [],
  habits: [],
  habitCompletions: [],
  collections: [],
  userName: "",
  userNameUpdatedAt: "1970-01-01T00:00:00.000Z",
  tombstones: {},
})

export const pickJournalData = (s: JournalData): JournalData => ({
  dailyLogs: s.dailyLogs,
  tags: s.tags,
  habits: s.habits,
  habitCompletions: s.habitCompletions,
  collections: s.collections,
  userName: s.userName,
  userNameUpdatedAt: s.userNameUpdatedAt,
  tombstones: s.tombstones,
})
