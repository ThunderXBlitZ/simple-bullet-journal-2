"use client"

import { useState } from "react"
import { CheckIcon } from "@/components/icons/check"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { randomPlaceholder } from "@/lib/placeholders"
import { tagColor } from "@/lib/tag-presets"
import { cn } from "@/lib/utils"
import { JournalIcon, ICON_CHOICES } from "@/components/journal/journal-icon"

const habitIcons = ICON_CHOICES.slice(0, 8)
export const habitColors = ["#b86b66", "#cf9a6b", "#c2a867", "#7fa585", "#6fa3a3", "#6f8fb0", "#8f7fae", "#c4838f"]

export interface HabitDraft {
  name: string
  icon: string
  color: string
}

interface HabitFormProps {
  initial?: HabitDraft
  onSubmit: (draft: HabitDraft) => void
  onCancel?: () => void
}

/** Create/edit form. Mounted fresh each time it opens, so the placeholder is re-rolled per open. */
export function HabitForm({ initial, onSubmit, onCancel }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState(initial?.icon ?? habitIcons[0])
  const [color, setColor] = useState(initial?.color ? tagColor(initial.color) : habitColors[0])
  const [placeholder] = useState(randomPlaceholder)

  const submit = () => {
    if (name.trim()) onSubmit({ name: name.trim(), icon, color })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
      <Input
        autoComplete="off"
        name="habit-label"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        className="font-serif"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") submit()
          if (e.key === "Escape") onCancel?.()
        }}
      />
      {name.trim() && (
        <Button size="icon" className="shrink-0" onClick={submit} aria-label="Save habit">
          <CheckIcon size={16} />
        </Button>
      )}
      </div>
      {name.trim() && (<>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Icon:</span>
        <div className="flex gap-1 flex-wrap">
          {habitIcons.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={cn("w-8 h-8 rounded flex items-center justify-center transition-colors", icon === i ? "bg-accent" : "hover:bg-accent/50")}
            >
              <JournalIcon name={i} />
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
      </>)}
    </div>
  )
}
