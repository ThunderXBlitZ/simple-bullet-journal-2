"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface MoodDropdownProps {
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

export function MoodDropdown({ value, onChange }: MoodDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
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

  const currentMood = moods.find((m) => m.value === value)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors"
      >
        {currentMood && (
          <>
            <div className={cn("w-4 h-4 rounded-full", currentMood.color)} />
            <span className="text-sm font-serif">{currentMood.label}</span>
          </>
        )}
        {!currentMood && <span className="text-sm text-muted-foreground font-serif">Mood</span>}
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
          {moods.map((mood) => (
            <button
              key={mood.value}
              onClick={() => {
                onChange(mood.value)
                setIsOpen(false)
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm font-serif text-left hover:bg-accent transition-colors",
                value === mood.value && "bg-accent",
                mood.value === 1 && "rounded-t-lg",
                mood.value === 5 && "rounded-b-lg",
              )}
            >
              <div className={cn("w-3 h-3 rounded-full", mood.color)} />
              {mood.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
