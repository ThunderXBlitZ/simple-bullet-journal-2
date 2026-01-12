"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import type { BulletEntry, Tag } from "@/lib/types"
import { BulletIcon } from "./bullet-icon"
import { TagSelector } from "./tag-selector"
import { cn } from "@/lib/utils"
import { Trash2, Edit2, Check, X } from "lucide-react"
import { useJournalStore } from "@/lib/journal-store"

interface EntryItemProps {
  entry: BulletEntry
  onUpdate: (updates: Partial<BulletEntry>) => void
  onDelete: () => void
  onCycleStatus: () => void
  date: string
  readonly?: boolean
  index?: number
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export function EntryItem({ entry, onUpdate, onDelete, onCycleStatus, date, readonly, index, onReorder }: EntryItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(entry.title || "")
  const [editContent, setEditContent] = useState(entry.content)
  const [editTagIds, setEditTagIds] = useState(entry.tagIds || [])
  const [isDragging, setIsDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const { addTagToEntry, removeTagFromEntry, tags } = useJournalStore()

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [isEditing])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setEditTitle(entry.title || "")
      setEditContent(entry.content)
      setEditTagIds(entry.tagIds || [])
      setIsEditing(false)
    }
  }

  const handleSaveEdit = () => {
    if (editTitle.trim() && editContent.trim()) {
      onUpdate({
        title: editTitle.trim(),
        content: editContent.trim(),
        tagIds: editTagIds
      })

      // Update tags via the store methods
      const currentTagIds = entry.tagIds || []
      for (const tagId of editTagIds) {
        if (!currentTagIds.includes(tagId)) {
          addTagToEntry(date, entry.id, tagId)
        }
      }
      for (const tagId of currentTagIds) {
        if (!editTagIds.includes(tagId)) {
          removeTagFromEntry(date, entry.id, tagId)
        }
      }

      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditTitle(entry.title || "")
    setEditContent(entry.content)
    setEditTagIds(entry.tagIds || [])
    setIsEditing(false)
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (index !== undefined) {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", index.toString())
      setIsDragging(true)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    setIsDragging(false)

    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10)
    if (index !== undefined && onReorder && fromIndex !== index) {
      onReorder(fromIndex, index)
    }
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragOver(false)
  }

  const isComplete = entry.status === "complete" || entry.status === "irrelevant"

  return (
    <div
      draggable={!readonly && !isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      className={cn(
        "flex flex-col gap-0.5 py-1 group hover:bg-accent/20 rounded-sm transition-colors",
        isComplete && "opacity-60",
        dragOver && "bg-accent/50 border-l-2 border-primary",
        !readonly && !isEditing && "cursor-grab active:cursor-grabbing",
      )}
      style={{ paddingLeft: `${entry.indent * 24 + 4}px`, paddingRight: "4px" }}
    >
      {isEditing ? (
        <>
          {/* Edit Mode */}
          <div className="flex items-start gap-2">
            <BulletIcon type={entry.type} status={entry.status} onClick={entry.type === "task" ? onCycleStatus : undefined} />
            <div className="flex-1 flex flex-col gap-2 pb-4">
              <input
                ref={titleRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Title"
                className="bg-transparent border-none outline-none text-foreground font-serif text-base font-semibold"
              />
              <textarea
                ref={contentRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Description"
                rows={3}
                className="bg-transparent border-none outline-none text-foreground font-serif text-base resize-none"
              />
            </div>
          </div>

          {/* Edit Actions */}
          <div className="flex items-center gap-2 ml-6">
            <span className="text-xs text-muted-foreground">
              Tab to indent
            </span>
            <button
              onClick={handleSaveEdit}
              className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded hover:bg-muted/80 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>

          {/* Edit Tags */}
          <div className="ml-6 flex items-center gap-2">
            <TagSelector selectedTagIds={editTagIds} onTagsChange={setEditTagIds} />
          </div>
        </>
      ) : (
        <>
          {/* View Mode */}
          <div className="flex items-start gap-2 pb-4">
            <BulletIcon type={entry.type} status={entry.status} onClick={entry.type === "task" ? onCycleStatus : undefined} />
            <div className="flex-1 flex flex-col gap-2">
              {entry.title && (
                <span className={cn("font-serif font-semibold text-base", isComplete && "line-through")}>
                  {entry.title}
                </span>
              )}
              <span className={cn("font-serif text-base", isComplete && "line-through")}>
                {entry.content}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {!readonly && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 hover:bg-accent/50 rounded text-muted-foreground hover:text-foreground"
                  aria-label="Edit entry"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {!readonly && (
                <button
                  onClick={onDelete}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                  aria-label="Delete entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* View Tags - Display Only */}
          {!readonly && entry.tagIds && entry.tagIds.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-6">
              {entry.tagIds.map((tagId: string) => {
                const tag = tags.find((t: Tag) => t.id === tagId)
                if (!tag) return null
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
