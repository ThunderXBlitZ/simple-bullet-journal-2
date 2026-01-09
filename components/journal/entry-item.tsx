"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import type { BulletEntry } from "@/lib/types"
import { BulletIcon } from "./bullet-icon"
import { cn } from "@/lib/utils"
import { Trash2 } from "lucide-react"

interface EntryItemProps {
  entry: BulletEntry
  onUpdate: (updates: Partial<BulletEntry>) => void
  onDelete: () => void
  onCycleStatus: () => void
}

export function EntryItem({ entry, onUpdate, onDelete, onCycleStatus }: EntryItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(entry.content)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (editContent.trim()) {
        onUpdate({ content: editContent.trim() })
      }
      setIsEditing(false)
    } else if (e.key === "Escape") {
      setEditContent(entry.content)
      setIsEditing(false)
    }
  }

  const isComplete = entry.status === "complete" || entry.status === "irrelevant"

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 group hover:bg-accent/30 rounded-sm transition-colors -mx-2 px-2",
        isComplete && "opacity-60",
      )}
      style={{ paddingLeft: `${entry.indent * 24 + 8}px` }}
    >
      <BulletIcon type={entry.type} status={entry.status} onClick={entry.type === "task" ? onCycleStatus : undefined} />

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (editContent.trim()) {
              onUpdate({ content: editContent.trim() })
            }
            setIsEditing(false)
          }}
          className="flex-1 bg-transparent border-none outline-none text-foreground font-serif text-base"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={cn("flex-1 cursor-text font-serif text-base", isComplete && "line-through")}
        >
          {entry.content}
        </span>
      )}

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
        aria-label="Delete entry"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
