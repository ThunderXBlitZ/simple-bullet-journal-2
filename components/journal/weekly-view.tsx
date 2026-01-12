"use client"

import { useState } from "react"
import { format, startOfWeek, addDays, subWeeks, addWeeks, isToday } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { getRandomQuote } from "@/lib/quotes"
import { EntryItem } from "./entry-item"
import { cn } from "@/lib/utils"

interface WeeklyViewProps {
  onDateClick?: (date: Date) => void
}

export function WeeklyView({ onDateClick }: WeeklyViewProps = {}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [quote, setQuote] = useState(() => getRandomQuote())

  const { getDailyLog, updateEntry, deleteEntry, cycleStatus } = useJournalStore()

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const goPrevWeek = () => {
    setWeekStart((w) => subWeeks(w, 1))
    setQuote(getRandomQuote())
  }
  const goNextWeek = () => {
    setWeekStart((w) => addWeeks(w, 1))
    setQuote(getRandomQuote())
  }
  const goThisWeek = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
    setQuote(getRandomQuote())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="md:hidden font-serif text-sm font-semibold text-foreground">My Bullet Journal</div>

          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={goPrevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={goThisWeek}
              className="font-serif text-base md:text-lg whitespace-nowrap"
            >
              Week of {format(weekStart, "MMM d")}
            </Button>
            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={goNextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Week Grid */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const log = getDailyLog(dateStr)
            const dayIsToday = isToday(day)

            return (
              <button
                key={dateStr}
                onClick={() => onDateClick?.(day)}
                className={cn(
                  "border border-border rounded-lg p-3 min-h-[200px] flex flex-col text-left transition-colors hover:bg-accent/10",
                  dayIsToday && "border-primary/50 bg-accent/30",
                )}
              >
                <div
                  className={cn(
                    "font-serif text-sm mb-2 pb-2 border-b border-border",
                    dayIsToday && "font-semibold text-primary",
                  )}
                >
                  <span className="block text-muted-foreground text-xs">{format(day, "EEEE")}</span>
                  {format(day, "MMM d")}
                </div>

                <div className="flex-1 space-y-0.5 text-sm overflow-y-auto">
                  {log.entries.slice(0, 5).map((entry) => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      date={dateStr}
                      onUpdate={(updates) => updateEntry(dateStr, entry.id, updates)}
                      onDelete={() => deleteEntry(dateStr, entry.id)}
                      onCycleStatus={() => cycleStatus(dateStr, entry.id)}
                      readonly={true}
                    />
                  ))}
                  {log.entries.length > 5 && (
                    <span className="text-xs text-muted-foreground">+{log.entries.length - 5} more</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Inspiration Quote */}
        <div className="py-2 border-t border-border text-center">
          <p className="text-sm font-serif text-muted-foreground italic">{quote}</p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border pt-4">
          <span>• Task</span>
          <span>○ Event</span>
          <span>— Note</span>
        </div>
      </div>
    </div>
  )
}
