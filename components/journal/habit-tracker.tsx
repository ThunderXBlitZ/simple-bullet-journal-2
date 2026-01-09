"use client"

import { useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isToday } from "date-fns"
import { ChevronLeft, ChevronRight, Plus, Trash2, Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useJournalStore } from "@/lib/journal-store"
import { cn } from "@/lib/utils"

const defaultIcons = ["📚", "💪", "🧘", "💧", "🏃", "✍️", "🎯", "💤"]
const defaultColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

export function HabitTracker() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isAdding, setIsAdding] = useState(false)
  const [newHabitName, setNewHabitName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState(defaultIcons[0])
  const [selectedColor, setSelectedColor] = useState(defaultColors[0])

  const { habits, habitCompletions, addHabit, deleteHabit, toggleHabitCompletion, getHabitStreak } = useJournalStore()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const goPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1))
  const goNextMonth = () => setCurrentMonth((m) => addMonths(m, 1))
  const goThisMonth = () => setCurrentMonth(new Date())

  const handleAddHabit = () => {
    if (newHabitName.trim()) {
      addHabit(newHabitName.trim(), selectedIcon, selectedColor)
      setNewHabitName("")
      setIsAdding(false)
    }
  }

  const isHabitComplete = (habitId: string, date: string) => {
    return habitCompletions.some((c) => c.habitId === habitId && c.date === date && c.completed)
  }

  const getCompletionRate = (habitId: string) => {
    const monthCompletions = days.filter((day) => isHabitComplete(habitId, format(day, "yyyy-MM-dd"))).length
    return Math.round((monthCompletions / days.length) * 100)
  }

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

        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Habit
        </Button>
      </div>

      {/* Add Habit Form */}
      {isAdding && (
        <div className="py-4 border-b border-border space-y-3">
          <Input
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder="Habit name..."
            className="font-serif"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddHabit()
              if (e.key === "Escape") setIsAdding(false)
            }}
          />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Icon:</span>
              <div className="flex gap-1">
                {defaultIcons.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={cn(
                      "w-8 h-8 rounded flex items-center justify-center transition-colors",
                      selectedIcon === icon ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Color:</span>
              <div className="flex gap-1">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform",
                      selectedColor === color &&
                        "ring-2 ring-offset-2 ring-offset-background ring-foreground/30 scale-110",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddHabit}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Habit Grid */}
      <div className="flex-1 overflow-x-auto py-4">
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <CheckSquareIcon className="w-12 h-12 mb-2 opacity-50" />
            <p className="font-serif">No habits yet</p>
            <p className="text-sm">Add a habit to start tracking</p>
          </div>
        ) : (
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="flex items-center gap-1 mb-2">
              <div className="w-40" />
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center text-xs",
                    isToday(day) && "text-primary font-bold",
                  )}
                >
                  {format(day, "d")}
                </div>
              ))}
              <div className="w-20 text-center text-xs text-muted-foreground">Rate</div>
              <div className="w-16 text-center text-xs text-muted-foreground">Streak</div>
              <div className="w-8" />
            </div>

            {/* Habits */}
            {habits.map((habit) => {
              const streak = getHabitStreak(habit.id)
              const rate = getCompletionRate(habit.id)

              return (
                <div key={habit.id} className="flex items-center gap-1 mb-1 group">
                  <div className="w-40 flex items-center gap-2 pr-2 truncate">
                    <span>{habit.icon}</span>
                    <span className="font-serif text-sm truncate">{habit.name}</span>
                  </div>

                  {days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd")
                    const completed = isHabitComplete(habit.id, dateStr)

                    return (
                      <button
                        key={dateStr}
                        onClick={() => toggleHabitCompletion(habit.id, dateStr)}
                        className={cn(
                          "w-7 h-7 rounded-sm transition-colors flex items-center justify-center",
                          completed ? "bg-habit-complete" : "bg-habit-incomplete hover:bg-accent",
                          isToday(day) && !completed && "ring-1 ring-primary/30",
                        )}
                        style={completed ? { backgroundColor: habit.color } : undefined}
                      >
                        {completed && (
                          <svg viewBox="0 0 16 16" className="w-3 h-3 text-white">
                            <path
                              d="M3 8l3 3 7-7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    )
                  })}

                  <div className="w-20 text-center text-sm font-mono">{rate}%</div>

                  <div className="w-16 flex items-center justify-center gap-1 text-sm">
                    {streak > 0 && (
                      <>
                        <Flame className="w-3 h-3 text-orange-500" />
                        <span className="font-mono">{streak}</span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="w-8 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
