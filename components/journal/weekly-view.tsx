"use client"

import { useState } from "react"
import { format, startOfWeek, addDays, subWeeks, addWeeks, isToday } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { EntryItem } from "./entry-item"
import { EntryInput } from "./entry-input"
import { cn } from "@/lib/utils"

export function WeeklyView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const { getDailyLog, addEntry, updateEntry, deleteEntry, cycleStatus } = useJournalStore()

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const goPrevWeek = () => setWeekStart((w) => subWeeks(w, 1))
  const goNextWeek = () => setWeekStart((w) => addWeeks(w, 1))
  const goThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goPrevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={goThisWeek} className="font-serif text-lg">
            Week of {format(weekStart, "MMM d")}
          </Button>
          <Button variant="ghost" size="icon" onClick={goNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week Grid */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const log = getDailyLog(dateStr)
            const dayIsToday = isToday(day)

            return (
              <div
                key={dateStr}
                className={cn(
                  "border border-border rounded-lg p-3 min-h-[200px] flex flex-col",
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
                  {log.mood && <span className={cn("ml-2 inline-block w-2 h-2 rounded-full", `bg-mood-${log.mood}`)} />}
                </div>

                <div className="flex-1 space-y-0.5 text-sm overflow-y-auto">
                  {log.entries.slice(0, 5).map((entry) => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      onUpdate={(updates) => updateEntry(dateStr, entry.id, updates)}
                      onDelete={() => deleteEntry(dateStr, entry.id)}
                      onCycleStatus={() => cycleStatus(dateStr, entry.id)}
                    />
                  ))}
                  {log.entries.length > 5 && (
                    <span className="text-xs text-muted-foreground">+{log.entries.length - 5} more</span>
                  )}
                </div>

                <div className="mt-2 pt-2 border-t border-dashed border-border">
                  <EntryInput
                    onSubmit={(type, content, indent) => addEntry(dateStr, type, content, indent)}
                    placeholder="Add..."
                    autoFocus={false}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
