"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { useJournalStore } from "@/lib/journal-store"
import { tagPresets } from "@/lib/tag-presets"
import { cn } from "@/lib/utils"
import type { Tag } from "@/lib/types"

interface TagSelectorProps {
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
}

export function TagSelector({ selectedTagIds, onTagsChange }: TagSelectorProps) {
  const { tags, addTag } = useJournalStore()
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [selectedColor, setSelectedColor] = useState(tagPresets[0].color)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id))

  const handleAddTag = () => {
    if (newTagName.trim()) {
      const newTag = {
        id: Math.random().toString(36).substring(2, 15),
        name: newTagName.trim(),
        color: selectedColor,
        createdAt: new Date().toISOString(),
      }
      addTag(newTagName.trim(), selectedColor)
      // Automatically select the newly created tag
      onTagsChange([...selectedTagIds, newTag.id])
      setNewTagName("")
      setSelectedColor(tagPresets[0].color)
    }
  }

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onTagsChange([...selectedTagIds, tagId])
    }
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2" ref={dropdownRef}>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleToggleTag(tag.id)}
                className="hover:opacity-70 transition-opacity"
                title="Remove tag"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-accent transition-colors"
        title="Add tags"
      >
        <Plus className="w-3 h-3" />
        Tags
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[200px]">
          {/* Existing tags */}
          <div className="max-h-[150px] overflow-y-auto">
            {tags.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">No tags yet</div>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                    selectedTagIds.includes(tag.id) && "bg-accent"
                  )}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-foreground">{tag.name}</span>
                  {selectedTagIds.includes(tag.id) && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))
            )}
          </div>

          {/* Add new tag */}
          <div className="border-t border-border px-3 py-2 space-y-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name..."
              className="w-full text-xs px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTag()
              }}
            />

            <div className="flex gap-1 flex-wrap">
              {tagPresets.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => setSelectedColor(preset.color)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-transform",
                    selectedColor === preset.color && "ring-2 ring-offset-2 ring-offset-background ring-foreground/30 scale-110"
                  )}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>

            <button
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
              className="w-full text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Tag
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
