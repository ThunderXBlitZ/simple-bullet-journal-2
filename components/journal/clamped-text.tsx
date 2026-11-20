"use client"

import { useState, useRef, useLayoutEffect } from "react"
import { ChevronDownIcon } from "@/components/icons/chevron-down"
import { ChevronUpIcon } from "@/components/icons/chevron-up"
import { cn } from "@/lib/utils"

interface ClampedTextProps {
  text: string
  className?: string
  /** 5 = expandable (daily); 2 = fixed clamp, no toggle (weekly). */
  lines?: 2 | 5
}

const clampClass = { 2: "line-clamp-2", 5: "line-clamp-5" } as const

export function ClampedText({ text, className, lines = 5 }: ClampedTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || lines === 2) return
    const measure = () => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, expanded, lines])

  return (
    <div className="flex flex-col items-start">
      <span
        ref={ref}
        className={cn("block whitespace-pre-wrap break-words", !expanded && clampClass[lines], className)}
      >
        {text}
      </span>
      {lines === 5 && (overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}
