"use client"

import { useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, addMonths, isToday } from "date-fns"
import { ChevronLeft, ChevronRight, Plus, Trash2, Flame, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HabitForm } from "./habit-form"
import { SortableItem, SortableList } from "./sortable"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { getRandomQuote } from "@/lib/quotes"
import { cn } from "@/lib/utils"
import { JournalIcon } from "@/components/journal/journal-icon"

export function HabitTracker() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [quote, setQuote] = useState(() => getRandomQuote())
  const { habits, habitCompletions, addHabit, updateHabit, deleteHabit, toggleHabitCompletion, getHabitStreak, reorderHabits, userName } = useJournalStore(useShallow((s) => ({ habits: s.habits, habitCompletions: s.habitCompletions, addHabit: s.addHabit, updateHabit: s.updateHabit, deleteHabit: s.deleteHabit, toggleHabitCompletion: s.toggleHabitCompletion, getHabitStreak: s.getHabitStreak, reorderHabits: s.reorderHabits, userName: s.userName })))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

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

  const editingHabit = habits.find((h) => h.id === editingId)

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
      <div className="pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="md:hidden min-w-0 truncate font-serif text-base font-semibold text-foreground">
            {userName}<span className="hidden min-[480px]:inline">'s Bullet Journal</span>
          </div>

          <div className="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
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

      {/* Add / Edit Habit */}
      <div className="px-0 py-2 border-b border-dashed border-border space-y-3">
        {isAdding ? (
          <HabitForm
            submitLabel="Add Habit"
            onCancel={() => setIsAdding(false)}
            onSubmit={(d) => {
              addHabit(d.name, d.icon, d.color, d.date)
              setIsAdding(false)
            }}
          />
        ) : editingHabit ? (
          <HabitForm
            key={editingHabit.id}
            initial={editingHabit}
            submitLabel="Save"
            onCancel={() => setEditingId(null)}
            onSubmit={(d) => {
              updateHabit(editingHabit.id, d)
              setEditingId(null)
            }}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="w-3 h-3 mr-1" />
            New habit
          </Button>
        )}
      </div>

      {/* Habit Grid */}
      <div className="flex-1 overflow-x-auto py-4">
        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="text-6xl mb-4 font-mono">o_o</div>
            <p className="text-lg font-serif">{quote}</p>
            <p className="text-xs text-muted-foreground/60">Add a habit to start tracking</p>
          </div>
        ) : (
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="flex items-center gap-1 mb-2">
              <div className="w-5" />
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
              <div className="w-14" />
            </div>

            {/* Habits */}
            <SortableList ids={habits.map((h) => h.id)} onReorder={reorderHabits}>
            {habits.map((habit) => {
              const streak = getHabitStreak(habit.id)
              const rate = getCompletionRate(habit.id)

              return (
                <SortableItem
                  key={habit.id}
                  id={habit.id}
                  className="flex items-center gap-1 mb-1 group bg-background"
                  handleClassName="w-5"
                >
                  <div className="w-40 flex items-center gap-2 pr-2 truncate">
                    <JournalIcon name={habit.icon} />
                    <span className="font-serif text-sm truncate" title={habit.date ? `${habit.name} · ${habit.date}` : habit.name}>{habit.name}</span>
                    {habit.date && <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1">{habit.date.slice(5)}</span>}
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

                  <div className="w-14 flex opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setIsAdding(false)
                        setEditingId(habit.id)
                      }}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                      aria-label="Edit habit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                      aria-label="Delete habit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </SortableItem>
              )
            })}
            </SortableList>
          </div>
        )}

        {/* Inspiration Quote */}
        {habits.length > 0 && (
          <div className="py-2 border-t border-border text-center">
            <p className="text-sm font-serif text-muted-foreground italic">{quote}</p>
          </div>
        )}
      </div>
    </div>
  )
}
