"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import type { BulletType } from "@/lib/types"
import { BulletIcon } from "./bullet-icon"
import { cn } from "@/lib/utils"

interface EntryInputProps {
  onSubmit: (type: BulletType, content: string, indent: number) => void
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
  placeholder = "Add an entry...",
  className,
  onCancel,
}: EntryInputProps) {
  const [type, setType] = useState<BulletType>(initialType)
  const [content, setContent] = useState(initialContent)
  const [indent, setIndent] = useState(initialIndent)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const cycleType = () => {
    const types: BulletType[] = ["task", "event", "note"]
    const currentIndex = types.indexOf(type)
    setType(types[(currentIndex + 1) % types.length])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && content.trim()) {
      onSubmit(type, content.trim(), indent)
      setContent("")
      setIndent(0)
    } else if (e.key === "Escape") {
      onCancel?.()
    } else if (e.key === "Tab") {
      e.preventDefault()
      if (e.shiftKey) {
        setIndent(Math.max(0, indent - 1))
      } else {
        setIndent(Math.min(3, indent + 1))
      }
    }
  }

  return (
    <div className={cn("flex items-center gap-2 py-1.5 group", className)} style={{ paddingLeft: `${indent * 24}px` }}>
      <BulletIcon type={type} status="open" onClick={cycleType} />
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 font-serif text-base"
      />
      <span className="text-xs text-muted-foreground opacity-0 group-focus-within:opacity-100 transition-opacity">
        Tab to indent
      </span>
    </div>
  )
}
