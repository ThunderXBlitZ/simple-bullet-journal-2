// Bullet Journal Types

export type BulletType = "task" | "event" | "note"
export type BulletStatus = "open" | "complete" | "migrated" | "scheduled" | "irrelevant"

export interface BulletEntry {
  id: string
  type: BulletType
  status: BulletStatus
  content: string
  indent: number
  createdAt: string
  updatedAt: string
}

export interface DailyLog {
  date: string // YYYY-MM-DD
  entries: BulletEntry[]
  mood?: number // 1-5
  gratitude?: string
  morningNote?: string
  eveningNote?: string
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  createdAt: string
}

export interface HabitCompletion {
  habitId: string
  date: string // YYYY-MM-DD
  completed: boolean
}

export interface Collection {
  id: string
  name: string
  icon: string
  items: CollectionItem[]
  createdAt: string
}

export interface CollectionItem {
  id: string
  content: string
  completed: boolean
  createdAt: string
}

export interface JournalState {
  dailyLogs: Record<string, DailyLog>
  habits: Habit[]
  habitCompletions: HabitCompletion[]
  collections: Collection[]
  settings: {
    showDots: boolean
    showLines: boolean
    focusMode: boolean
  }
}
