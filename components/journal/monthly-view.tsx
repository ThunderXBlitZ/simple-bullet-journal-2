"use client"

import { useState } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { getRandomQuote } from "@/lib/quotes"
import { cn } from "@/lib/utils"
import { DndContext, DragOverlay, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core"
import type { BulletEntry } from "@/lib/types"
import { getHabitsForDate } from "@/lib/journal-helpers"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BulletIcon } from "./bullet-icon"
import { EntryDragChip, resolveEntryDrop, useEntrySensors, type EntryDragData } from "./entry-dnd"
import { MonthlyDayCell, type DayData } from "./monthly-day-cell"

interface MonthlyViewProps {
  onDateClick?: (date: Date) => void
}

export function MonthlyView({ onDateClick }: MonthlyViewProps = {}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [quote, setQuote] = useState(() => getRandomQuote())
  const { getDailyLog, habits, habitCompletions, moveEntry, userName } = useJournalStore()
  const sensors = useEntrySensors()
  const [dragging, setDragging] = useState<BulletEntry | null>(null)
  const [dialogDate, setDialogDate] = useState<string | null>(null)

  const dayData = (dateStr: string): DayData => ({
    dateStr,
    entries: getDailyLog(dateStr).entries,
    habits: getHabitsForDate(habits, dateStr).map((habit) => ({
      habit,
      done: habitCompletions.some((c) => c.habitId === habit.id && c.date === dateStr && c.completed),
    })),
    habitsDone: habitCompletions.filter((c) => c.date === dateStr && c.completed).length,
  })

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current as EntryDragData | undefined)?.entry ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const drop = resolveEntryDrop(e)
    if (drop) moveEntry(drop.from, drop.to, drop.id)
  }
  const dialogData = dialogDate ? dayData(dialogDate) : null

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const goPrevMonth = () => {
    setCurrentMonth((m) => subMonths(m, 1))
    setQuote(getRandomQuote())
  }
  const goNextMonth = () => {
    setCurrentMonth((m) => addMonths(m, 1))
    setQuote(getRandomQuote())
  }
  const goThisMonth = () => {
    setCurrentMonth(new Date())
    setQuote(getRandomQuote())
  }

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="md:hidden font-serif text-sm font-semibold text-foreground">
            {userName}'s Bullet Journal
          </div>

          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={goPrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={goThisMonth}
              className="font-serif text-base md:text-lg whitespace-nowrap"
            >
              {format(currentMonth, "MMMM yyyy")}
            </Button>
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={goNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground font-serif py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd")
              return (
                <MonthlyDayCell
                  key={dateStr}
                  day={day}
                  data={dayData(dateStr)}
                  inMonth={isSameMonth(day, currentMonth)}
                  isToday={isToday(day)}
                  onOpenDay={() => onDateClick?.(day)}
                  onShowAll={() => setDialogDate(dateStr)}
                />
              )
            })}
          </div>
          <DragOverlay>
            <EntryDragChip entry={dragging} />
          </DragOverlay>
        </DndContext>

        <Dialog open={!!dialogData} onOpenChange={(o) => !o && setDialogDate(null)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">{dialogDate && format(new Date(`${dialogDate}T00:00:00`), "EEEE, MMM d")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {dialogData?.entries.map((e) => (
                <div key={e.id} className="flex items-start gap-2 font-serif text-sm">
                  <BulletIcon type={e.type} status={e.status} />
                  <span className="whitespace-pre-wrap break-words min-w-0">{e.title || e.content}</span>
                </div>
              ))}
              {dialogData?.habits.map(({ habit, done }) => (
                <div key={habit.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-habit-complete w-3.5 text-center">{done ? "✓" : "◇"}</span>
                  <span>{habit.name}</span>
                </div>
              ))}
              {dialogData && dialogData.entries.length + dialogData.habits.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing logged.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 self-start bg-transparent"
                onClick={() => {
                  if (dialogDate) onDateClick?.(new Date(`${dialogDate}T00:00:00`))
                  setDialogDate(null)
                }}
              >
                Open day
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Inspiration Quote */}
        <div className="py-2 border-t border-border text-center">
          <p className="text-sm font-serif text-muted-foreground italic">{quote}</p>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-4">
          <span>• Task</span>
          <span>○ Event</span>
          <span>— Note</span>
          <div className="flex items-center gap-2">
            <span className="text-habit-complete">✓</span>
            <span>Habits</span>
          </div>
        </div>
      </div>
    </div>
  )
}
