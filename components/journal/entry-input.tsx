"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import type { BulletType } from "@/lib/types"
import { BulletIcon } from "./bullet-icon"
import { TagSelector } from "./tag-selector"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface EntryInputProps {
  onSubmit: (type: BulletType, content: string, indent: number, tagIds?: string[], title?: string) => void
  initialType?: BulletType
  initialContent?: string
  initialIndent?: number
  autoFocus?: boolean
  placeholder?: string
  className?: string
  onCancel?: () => void
}

export function EntryInput({
  onSubmit,
  initialType = "task",
  initialContent = "",
  initialIndent = 0,
  autoFocus = true,
  placeholder,
  className,
  onCancel,
}: EntryInputProps) {
  const [type, setType] = useState<BulletType>(initialType)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState(initialContent)
  const [indent, setIndent] = useState(initialIndent)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && titleRef.current) {
      titleRef.current.focus()
    }
  }, [autoFocus])

  const cycleType = () => {
    const types: BulletType[] = ["task", "event", "note"]
    const currentIndex = types.indexOf(type)
    setType(types[(currentIndex + 1) % types.length])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      onCancel?.()
    } else if (e.key === "Tab" && e.currentTarget instanceof HTMLTextAreaElement) {
      e.preventDefault()
      if (e.shiftKey) {
        setIndent(Math.max(0, indent - 1))
      } else {
        setIndent(Math.min(3, indent + 1))
      }
    }
  }

  const handleSubmit = () => {
    if (title.trim() && content.trim()) {
      onSubmit(type, content.trim(), indent, selectedTagIds, title.trim())
      setTitle("")
      setContent("")
      setIndent(0)
      setSelectedTagIds([])
      titleRef.current?.focus()
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 py-1.5 group", className)} style={{ paddingLeft: `${indent * 24}px` }}>
      <div className="flex items-start gap-2">
        <BulletIcon type={type} status="open" onClick={cycleType} />
        <div className="flex-1 flex flex-col gap-2">
          {/* Title Input */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are you grateful for today?"
            className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 font-serif text-base font-semibold"
          />

          {/* Description Textarea */}
          {title.trim() && (
            <textarea
              ref={descriptionRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Description"
              rows={3}
              className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 font-serif text-base resize-none"
            />
          )}
        </div>
      </div>

      {/* Actions */}
      {title.trim() && content.trim() && (
        <>
          <div className="flex items-center gap-2 ml-6">
            <span className="text-xs text-muted-foreground">
              Tab to indent
            </span>
            <button
              onClick={handleSubmit}
              className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
          </div>

          {/* Tag Selector */}
          <div className="ml-6 flex items-center gap-2">
            <TagSelector selectedTagIds={selectedTagIds} onTagsChange={setSelectedTagIds} />
          </div>
        </>
      )}
    </div>
  )
}
