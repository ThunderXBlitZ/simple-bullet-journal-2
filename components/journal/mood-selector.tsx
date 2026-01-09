"use client"

import { cn } from "@/lib/utils"

interface MoodSelectorProps {
  value?: number
  onChange: (mood: number) => void
}

const moods = [
  { value: 1, label: "Rough", color: "bg-mood-1" },
  { value: 2, label: "Meh", color: "bg-mood-2" },
  { value: 3, label: "Okay", color: "bg-mood-3" },
  { value: 4, label: "Good", color: "bg-mood-4" },
  { value: 5, label: "Great", color: "bg-mood-5" },
]

export function MoodSelector({ value, onChange }: MoodSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground font-serif">Mood:</span>
      <div className="flex items-center gap-1">
        {moods.map((mood) => (
          <button
            key={mood.value}
            onClick={() => onChange(mood.value)}
            title={mood.label}
            className={cn(
              "w-6 h-6 rounded-full transition-all",
              mood.color,
              value === mood.value
                ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/30 scale-110"
                : "opacity-40 hover:opacity-70",
            )}
          >
            <span className="sr-only">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
