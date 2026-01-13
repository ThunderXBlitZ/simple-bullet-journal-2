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

interface MonthlyViewProps {
  onDateClick?: (date: Date) => void
}

export function MonthlyView({ onDateClick }: MonthlyViewProps = {}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [quote, setQuote] = useState(() => getRandomQuote())
  const { getDailyLog, habits, habitCompletions, tags, userName } = useJournalStore()

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
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const log = getDailyLog(dateStr)
            const inMonth = isSameMonth(day, currentMonth)
            const dayIsToday = isToday(day)
            const taskCount = log.entries.filter((e) => e.type === "task").length
            const completedCount = log.entries.filter((e) => e.type === "task" && e.status === "complete").length
            const habitsCompleted = habitCompletions.filter((c) => c.date === dateStr && c.completed).length

            // Get first note entry
            const firstNote = log.entries.find((e) => e.type === "note")
            const firstNoteTag = firstNote?.tagIds?.[0] ? tags.find((t) => t.id === firstNote.tagIds?.[0]) : null

            return (
              <div
                key={dateStr}
                onClick={() => onDateClick?.(day)}
                className={cn(
                  "aspect-square p-1.5 border border-transparent rounded-lg transition-colors cursor-pointer",
                  "flex flex-col",
                  !inMonth && "opacity-30",
                  dayIsToday && "border-primary bg-accent/30",
                  inMonth && !dayIsToday && "hover:bg-accent/20",
                )}
              >
                <span className={cn("text-sm font-serif", dayIsToday && "font-bold text-primary")}>
                  {format(day, "d")}
                </span>

                {/* Note preview with tag color */}
                {firstNote && (
                  <div className="flex-1 flex items-start justify-between gap-0.5 min-h-0">
                    <span className="text-xs text-muted-foreground truncate flex-1">{firstNote.content}</span>
                    {firstNoteTag && (
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: firstNoteTag.color }}
                        title={firstNoteTag.name}
                      />
                    )}
                  </div>
                )}

                {/* Indicators */}
                <div className="flex-1 flex flex-col justify-end gap-0.5">
                  {/* Task progress */}
                  {taskCount > 0 && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(taskCount, 5) }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1 h-1 rounded-full",
                            i < completedCount ? "bg-bullet-complete" : "bg-muted-foreground/30",
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {/* Habit indicators */}
                  {habitsCompleted > 0 && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: Math.min(habitsCompleted, 5) }).map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-habit-complete" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Inspiration Quote */}
        <div className="py-2 border-t border-border text-center">
          <p className="text-sm font-serif text-muted-foreground italic">{quote}</p>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-4">
          <span>• Task</span>
          <span>○ Event</span>
          <span>— Note</span>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex gap-0.5">
              <div className="w-2 h-2 rounded-full bg-bullet-complete" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            </div>
            <span>Tasks</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-habit-complete" />
            <span>Habits</span>
          </div>
        </div>
      </div>
    </div>
  )
}
