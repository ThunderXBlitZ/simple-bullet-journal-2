"use client"

import { format } from "date-fns"
import { useDraggable } from "@dnd-kit/core"
import type { BulletEntry, Habit } from "@/lib/types"
import { cn } from "@/lib/utils"
import { DroppableDay, type EntryDragData } from "./entry-dnd"
import { Diamond } from "lucide-react"
import { CheckIcon } from "@/components/icons/check"

export interface DayData {
  dateStr: string
  entries: BulletEntry[]
  /** Dated habits for this day, with completion state. */
  habits: { habit: Habit; done: boolean }[]
  /** Habits completed on this day (any habit). */
  habitsDone: number
}

const glyph = { task: "•", event: "○", note: "—" } as const
const glyphColor = { task: "text-bullet-task", event: "text-bullet-event", note: "text-bullet-note" } as const

function EntryChip({ entry, date }: { entry: BulletEntry; date: string }) {
  const data: EntryDragData = { entryId: entry.id, date, entry }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${date}:${entry.id}`, data })
  const struck = entry.type === "task" && (entry.status === "complete" || entry.status === "irrelevant")
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className={cn("flex items-center gap-1 text-xs cursor-grab min-w-0", isDragging && "opacity-40")}
    >
      <span className={cn("flex-shrink-0 w-3 text-center", glyphColor[entry.type])}>{glyph[entry.type]}</span>
      <span className={cn("truncate text-muted-foreground", struck && "line-through")}>{entry.title || entry.content}</span>
    </div>
  )
}

interface DayCellProps {
  day: Date
  data: DayData
  inMonth: boolean
  isToday: boolean
  onOpenDay: () => void
  onShowAll: () => void
}

export function MonthlyDayCell({ day, data, inMonth, isToday, onOpenDay, onShowAll }: DayCellProps) {
  const { dateStr, entries, habits, habitsDone } = data
  const counts = { task: 0, event: 0, note: 0 }
  for (const e of entries) counts[e.type]++
  const habitCount = Math.max(habitsDone, habits.filter((h) => h.done).length)
  const total = entries.length + habits.length
  const showAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onShowAll()
  }

  return (
    <DroppableDay
      date={dateStr}
      onClick={onOpenDay}
      className={cn(
        "aspect-square md:aspect-auto md:min-h-[104px] p-1.5 border border-transparent rounded-lg transition-colors cursor-pointer flex flex-col min-w-0 overflow-hidden",
        !inMonth && "opacity-30",
        isToday && "border-primary bg-accent/30",
        inMonth && !isToday && "hover:bg-accent/20",
      )}
    >
      <span className={cn("text-sm font-serif", isToday && "font-bold text-primary")}>{format(day, "d")}</span>

      {/* Mobile: compact counts */}
      <button
        type="button"
        onClick={showAll}
        disabled={total === 0}
        className="md:hidden mt-auto flex flex-wrap gap-x-1 text-[10px] leading-tight text-left"
        aria-label="Show day items"
      >
        {(["task", "event", "note"] as const).map(
          (t) => counts[t] > 0 && (
            <span key={t} className={glyphColor[t]}>{glyph[t]}{counts[t]}</span>
          ),
        )}
        {habitCount > 0 && <span className="text-habit-complete inline-flex items-center"><CheckIcon size={12} />{habitCount}</span>}
      </button>

      {/* Desktop: entry chips */}
      <div className="hidden md:flex flex-col gap-0.5 mt-1 min-w-0">
        {entries.slice(0, 3).map((e) => (
          <EntryChip key={e.id} entry={e} date={dateStr} />
        ))}
        {habits.slice(0, Math.max(0, 3 - entries.length)).map(({ habit, done }) => (
          <div key={habit.id} className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            <span className={cn("w-3 text-center text-habit-complete flex-shrink-0")}>{done ? <CheckIcon size={12} /> : <Diamond className="size-3" />}</span>
            <span className={cn("truncate", done && "line-through")}>{habit.name}</span>
          </div>
        ))}
        {total > 3 && (
          <button type="button" onClick={showAll} className="text-xs text-muted-foreground hover:text-foreground text-left">
            +{total - 3} more
          </button>
        )}
        {habitCount > 0 && habits.length === 0 && <span className="text-xs text-habit-complete inline-flex items-center gap-0.5"><CheckIcon size={12} />{habitCount}</span>}
      </div>
    </DroppableDay>
  )
}
