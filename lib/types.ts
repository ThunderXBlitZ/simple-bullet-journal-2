// Bullet Journal Types

export type BulletType = "task" | "event" | "note"
export type BulletStatus = "open" | "complete" | "migrated" | "scheduled" | "irrelevant"

export interface BulletEntry {
  id: string
  type: BulletType
  status: BulletStatus
  title?: string
  content: string
  indent: number
  tagIds?: string[] // Tags applied to this entry
  order: number
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface DailyLog {
  date: string // YYYY-MM-DD
  entries: BulletEntry[]
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface HabitCompletion {
  habitId: string
  date: string // YYYY-MM-DD
  completed: boolean
  updatedAt: string
}

export interface Collection {
  id: string
  name: string
  icon: string
  items: CollectionItem[]
  createdAt: string
  updatedAt: string
}

export interface CollectionItem {
  id: string
  content: string
  completed: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export type Tombstones = Record<string, string> // record id -> ISO deletedAt

export interface JournalState {
  dailyLogs: Record<string, DailyLog>
  tags: Tag[]
  habits: Habit[]
  habitCompletions: HabitCompletion[]
  collections: Collection[]
  userName: string
  userNameUpdatedAt: string
  tombstones: Tombstones
  settings: {
    showDots: boolean
    showLines: boolean
    focusMode: boolean
    zoomLevel: number // 0.8, 0.9, 1, 1.1, 1.2, etc.
  }
  googleEmail: string | null
  syncAccountId: string | null // Google account this journal is linked to (kept after sign-out)
}
