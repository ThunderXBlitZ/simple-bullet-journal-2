"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { randomPlaceholder } from "@/lib/placeholders"
import { cn } from "@/lib/utils"

export const habitIcons = ["📚", "💪", "🧘", "💧", "🏃", "✍️", "🎯", "💤"]
export const habitColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

export interface HabitDraft {
  name: string
  icon: string
  color: string
  date?: string
}

interface HabitFormProps {
  initial?: HabitDraft
  submitLabel: string
  onSubmit: (draft: HabitDraft) => void
  onCancel: () => void
}

/** Create/edit form. Mounted fresh each time it opens, so the placeholder is re-rolled per open. */
export function HabitForm({ initial, submitLabel, onSubmit, onCancel }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState(initial?.icon ?? habitIcons[0])
  const [color, setColor] = useState(initial?.color ?? habitColors[0])
  const [date, setDate] = useState(initial?.date ?? "")
  const [placeholder] = useState(randomPlaceholder)

  const submit = () => {
    if (name.trim()) onSubmit({ name: name.trim(), icon, color, date: date || undefined })
  }

  return (
    <div className="space-y-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className="font-serif"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") submit()
          if (e.key === "Escape") onCancel()
        }}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Icon:</span>
        <div className="flex gap-1 flex-wrap">
          {habitIcons.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={cn("w-8 h-8 rounded flex items-center justify-center transition-colors", icon === i ? "bg-accent" : "hover:bg-accent/50")}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Color:</span>
        <div className="flex gap-1">
          {habitColors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn("w-6 h-6 rounded-full transition-transform", color === c && "ring-2 ring-offset-2 ring-offset-background ring-foreground/30 scale-110")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Date (optional):</span>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto font-mono" />
        {date && (
          <Button size="sm" variant="ghost" onClick={() => setDate("")}>
            Clear
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit}>
          <Plus className="w-3 h-3 mr-1" />
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
