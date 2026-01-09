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
import { cn } from "@/lib/utils"

export function MonthlyView() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { getDailyLog, habits, habitCompletions } = useJournalStore()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const goPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1))
  const goNextMonth = () => setCurrentMonth((m) => addMonths(m, 1))
  const goThisMonth = () => setCurrentMonth(new Date())

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goPrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={goThisMonth} className="font-serif text-lg">
            {format(currentMonth, "MMMM yyyy")}
          </Button>
          <Button variant="ghost" size="icon" onClick={goNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
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

            return (
              <div
                key={dateStr}
                className={cn(
                  "aspect-square p-1.5 border border-transparent rounded-lg transition-colors",
                  "flex flex-col",
                  !inMonth && "opacity-30",
                  dayIsToday && "border-primary bg-accent/30",
                  inMonth && !dayIsToday && "hover:bg-accent/20",
                )}
              >
                <span className={cn("text-sm font-serif", dayIsToday && "font-bold text-primary")}>
                  {format(day, "d")}
                </span>

                {/* Indicators */}
                <div className="flex-1 flex flex-col justify-end gap-0.5">
                  {/* Mood indicator */}
                  {log.mood && <div className={cn("w-full h-1 rounded-full", `bg-mood-${log.mood}`)} />}

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

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-4">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full bg-mood-3" />
            <span>Mood</span>
          </div>
        </div>
      </div>
    </div>
  )
}
