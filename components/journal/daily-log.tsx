"use client"

import { useState } from "react"
import { format, addDays, subDays, isToday } from "date-fns"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { getRandomQuote } from "@/lib/quotes"
import type { BulletType } from "@/lib/types"
import { EntryInput } from "./entry-input"
import { EntryItem } from "./entry-item"
import { cn } from "@/lib/utils"

interface DailyLogProps {
  className?: string
  initialDate?: Date
}

export function DailyLog({ className, initialDate }: DailyLogProps) {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date())
  const [quote, setQuote] = useState(() => getRandomQuote())
  const dateStr = format(currentDate, "yyyy-MM-dd")

  const {
    getDailyLog,
    addEntry,
    updateEntry,
    deleteEntry,
    cycleStatus,
    migrateIncompleteTasks,
    settings,
    reorderEntries,
    userName,
  } = useJournalStore()

  const dailyLog = getDailyLog(dateStr)

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
          <div className="md:hidden font-serif text-sm font-semibold text-foreground">
            {userName}'s Bullet Journal
          </div>

          {showMigrate && (
            <Button variant="outline" size="sm" onClick={handleMigrate} className="text-xs bg-transparent flex-shrink-0">
              <ArrowRight className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Migrate</span>
              <span className="sm:hidden">{incompleteTasks.length}</span>
            </Button>
          )}

          <div className="flex items-center gap-1 md:gap-2 ml-auto">
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
      <div className="px-0 py-2 border-b border-dashed border-border">
        <EntryInput onSubmit={handleAddEntry} />
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
        {dailyLog.entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="text-6xl mb-4 font-mono">^_^</div>
            <p className="text-lg font-serif">{quote}</p>
            <p className="text-xs text-muted-foreground/60">Start logging your day above</p>
          </div>
        ) : (
          <div className="space-y-0.5 pt-2">
            {dailyLog.entries.map((entry, index) => (
              <EntryItem
                key={entry.id}
                entry={entry}
                date={dateStr}
                index={index}
                onUpdate={(updates) => updateEntry(dateStr, entry.id, updates)}
                onDelete={() => deleteEntry(dateStr, entry.id)}
                onCycleStatus={() => cycleStatus(dateStr, entry.id)}
                onReorder={(fromIndex, toIndex) => reorderEntries(dateStr, fromIndex, toIndex)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inspiration Quote */}
      <div className="py-2 border-t border-border text-center">
        <p className="text-sm font-serif text-muted-foreground italic">{quote}</p>
      </div>

      {/* Legend */}
      <div className="py-2 border-t border-border flex flex-wrap gap-3 md:gap-4 text-xs text-muted-foreground">
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
