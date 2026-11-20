"use client"

import { useMemo, useState } from "react"
import { format, addDays, subDays, isToday } from "date-fns"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { getRandomQuote } from "@/lib/quotes"
import type { BulletType } from "@/lib/types"
import { EntryInput } from "./entry-input"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { SortableEntry, useEntrySensors } from "./entry-dnd"
import { cn } from "@/lib/utils"
import { completionIndex, getHabitsForDate } from "@/lib/journal-helpers"
import { JournalIcon } from "@/components/journal/journal-icon"

interface DailyLogProps {
  className?: string
  initialDate?: Date
}

export function DailyLog({ className, initialDate }: DailyLogProps) {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date())
  const [quote, setQuote] = useState(() => getRandomQuote())
  const dateStr = format(currentDate, "yyyy-MM-dd")

  const { getDailyLog, addEntry, updateEntry, deleteEntry, cycleStatus, migrateIncompleteTasks, settings, reorderEntries, userName, habits, habitCompletions, toggleHabitCompletion } = useJournalStore(useShallow((s) => ({ getDailyLog: s.getDailyLog, addEntry: s.addEntry, updateEntry: s.updateEntry, deleteEntry: s.deleteEntry, cycleStatus: s.cycleStatus, migrateIncompleteTasks: s.migrateIncompleteTasks, settings: s.settings, reorderEntries: s.reorderEntries, userName: s.userName, habits: s.habits, habitCompletions: s.habitCompletions, toggleHabitCompletion: s.toggleHabitCompletion })))
  useJournalStore((s) => s.dailyLogs) // getDailyLog reads get(); subscribe so entry edits re-render
  const index = useMemo(() => completionIndex(habitCompletions), [habitCompletions])

  const dailyLog = getDailyLog(dateStr)
  const dayHabits = getHabitsForDate(habits, dateStr)
  const sensors = useEntrySensors()

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = dailyLog.entries.map((e) => e.id)
    reorderEntries(dateStr, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setQuote(getRandomQuote())
  }
  const goPrevDay = () => {
    setCurrentDate((d) => subDays(d, 1))
    setQuote(getRandomQuote())
  }
  const goNextDay = () => {
    setCurrentDate((d) => addDays(d, 1))
    setQuote(getRandomQuote())
  }

  const handleAddEntry = (type: BulletType, content: string, indent: number, tagIds?: string[], title?: string) => {
    addEntry(dateStr, type, content, indent, tagIds, title)
  }

  const handleMigrate = () => {
    const today = format(new Date(), "yyyy-MM-dd")
    if (dateStr !== today) {
      migrateIncompleteTasks(dateStr, today)
    }
  }

  const incompleteTasks = dailyLog.entries.filter((e) => e.type === "task" && e.status === "open")

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const showMigrate = dateStr !== todayStr && incompleteTasks.length > 0

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      style={{
        "--zoom": settings.zoomLevel,
        fontSize: `${settings.zoomLevel * 100}%`
      } as React.CSSProperties & { "--zoom": number }}
    >
      {/* Header */}
      <div className="pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="md:hidden min-w-0 truncate font-serif text-base font-semibold text-foreground">
            {userName}<span className="hidden min-[480px]:inline">'s Bullet Journal</span>
          </div>

          {showMigrate && (
            <Button variant="outline" size="sm" onClick={handleMigrate} className="text-xs bg-transparent flex-shrink-0">
              <ArrowRight className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Migrate</span>
              <span className="sm:hidden">{incompleteTasks.length}</span>
            </Button>
          )}

          <div className="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={goPrevDay}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={goToToday}
              className={cn("font-serif text-base md:text-lg whitespace-nowrap", isToday(currentDate) && "text-primary font-semibold")}
            >
              {format(currentDate, "EEEE, MMM d")}
              {isToday(currentDate) && (
                <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full hidden sm:inline">Today</span>
              )}
            </Button>
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={goNextDay}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="px-0 py-4 border-b border-dashed border-border">
        <EntryInput onSubmit={handleAddEntry} />
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
        {dailyLog.entries.length === 0 && dayHabits.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="text-6xl mb-4 font-mono">^_^</div>
            <p className="text-lg font-serif">{quote}</p>
            <p className="text-xs text-muted-foreground/60">Start logging your day above</p>
          </div>
        ) : (
          <>
          {dayHabits.length > 0 && (
            <div className="space-y-1 pt-4">
              {dayHabits.map((h) => {
                const done = index.isDone(h.id, dateStr)
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleHabitCompletion(h.id, dateStr)}
                    className="flex items-center gap-2 text-sm text-muted-foreground px-1 py-1 w-full text-left hover:bg-accent/20 rounded-sm"
                  >
                    <span className={cn("w-3 h-3 rounded-full border border-habit-complete", done && "bg-habit-complete")} />
                    <span className={cn("truncate", done && "line-through")}><JournalIcon name={h.icon} size={14} className="mr-1.5 align-text-bottom" />{h.name}</span>
                  </button>
                )
              })}
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={dailyLog.entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 pt-4">
                {dailyLog.entries.map((entry) => (
                  <SortableEntry
                    key={entry.id}
                    entry={entry}
                    date={dateStr}
                    onUpdate={(updates) => updateEntry(dateStr, entry.id, updates)}
                    onDelete={() => deleteEntry(dateStr, entry.id)}
                    onCycleStatus={() => cycleStatus(dateStr, entry.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          </>
        )}
      </div>

      {/* Inspiration Quote */}
      <div className="py-2 border-t border-border text-center">
        <p className="text-sm font-serif text-muted-foreground italic">{quote}</p>
      </div>

      {/* Legend */}
      <div className="py-2 border-t border-border flex flex-wrap justify-center gap-3 md:gap-4 text-xs text-muted-foreground">
        <span>• Task</span>
        <span>○ Event</span>
        <span>— Note</span>
        <span>× Complete</span>
        <span>{">"} Migrated</span>
        <span>{"<"} Scheduled</span>
      </div>
    </div>
  )
}
