"use client"

import type { BulletType, BulletStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BulletIconProps {
  type: BulletType
  status: BulletStatus
  onClick?: () => void
  className?: string
}

export function BulletIcon({ type, status, onClick, className }: BulletIconProps) {
  const getIcon = () => {
    if (type === "event") {
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    }

    if (type === "note") {
      return (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
          <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    }

    // Task type
    switch (status) {
      case "complete":
        return (
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
            <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )
      case "migrated":
        return (
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
            <path
              d="M4 8 L12 8 M9 4 L13 8 L9 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      case "scheduled":
        return (
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
            <path
              d="M12 8 L4 8 M7 4 L3 8 L7 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      case "irrelevant":
        return (
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 opacity-40">
            <circle cx="8" cy="8" r="5" fill="currentColor" />
            <line x1="4" y1="8" x2="12" y2="8" stroke="var(--background)" strokeWidth="2" />
          </svg>
        )
      default: // open
        return (
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
            <circle cx="8" cy="8" r="5" fill="currentColor" />
          </svg>
        )
    }
  }

  const getColor = () => {
    if (type === "event") return "text-bullet-event"
    if (type === "note") return "text-bullet-note"
    if (status === "complete") return "text-bullet-complete"
    return "text-bullet-task"
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "bullet-dot flex-shrink-0 transition-colors hover:opacity-70",
        getColor(),
        onClick && "cursor-pointer",
        className,
      )}
      title={`${type} - ${status}`}
    >
      {getIcon()}
    </button>
  )
}
