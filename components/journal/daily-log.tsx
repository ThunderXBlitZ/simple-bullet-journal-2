"use client"

import { useState } from "react"
import { format, addDays, subDays, isToday } from "date-fns"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import type { BulletType } from "@/lib/types"
import { EntryInput } from "./entry-input"
import { EntryItem } from "./entry-item"
import { MoodSelector } from "./mood-selector"
import { cn } from "@/lib/utils"

interface DailyLogProps {
  className?: string
}

export function DailyLog({ className }: DailyLogProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const dateStr = format(currentDate, "yyyy-MM-dd")

  const {
    getDailyLog,
    addEntry,
    updateEntry,
    deleteEntry,
    cycleStatus,
    setMood,
    setGratitude,
    migrateIncompleteTasks,
  } = useJournalStore()

  const dailyLog = getDailyLog(dateStr)

  const goToToday = () => setCurrentDate(new Date())
  const goPrevDay = () => setCurrentDate((d) => subDays(d, 1))
  const goNextDay = () => setCurrentDate((d) => addDays(d, 1))

  const handleAddEntry = (type: BulletType, content: string, indent: number) => {
    addEntry(dateStr, type, content, indent)
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
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goPrevDay}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={goToToday}
            className={cn("font-serif text-lg", isToday(currentDate) && "text-primary font-semibold")}
          >
            {format(currentDate, "EEEE, MMMM d")}
            {isToday(currentDate) && (
              <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Today</span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={goNextDay}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {showMigrate && (
            <Button variant="outline" size="sm" onClick={handleMigrate} className="text-xs bg-transparent">
              <ArrowRight className="w-3 h-3 mr-1" />
              Migrate {incompleteTasks.length} task{incompleteTasks.length > 1 ? "s" : ""}
            </Button>
          )}
          <MoodSelector value={dailyLog.mood} onChange={(mood) => setMood(dateStr, mood)} />
        </div>
      </div>

      {/* Gratitude */}
      <div className="py-4 border-b border-border">
        <label className="text-sm text-muted-foreground font-serif block mb-2">Gratitude</label>
        <textarea
          value={dailyLog.gratitude || ""}
          onChange={(e) => setGratitude(dateStr, e.target.value)}
          placeholder="What are you grateful for today?"
          className="w-full bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/50 font-serif text-base min-h-[60px]"
        />
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-0.5">
          {dailyLog.entries.map((entry) => (
            <EntryItem
              key={entry.id}
              entry={entry}
              onUpdate={(updates) => updateEntry(dateStr, entry.id, updates)}
              onDelete={() => deleteEntry(dateStr, entry.id)}
              onCycleStatus={() => cycleStatus(dateStr, entry.id)}
            />
          ))}
        </div>

        <div className="mt-4 border-t border-dashed border-border pt-4">
          <EntryInput onSubmit={handleAddEntry} />
        </div>
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
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
