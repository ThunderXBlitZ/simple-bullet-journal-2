"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarDays, CheckSquare, ChevronDown, List, Search, Settings } from "lucide-react"

type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

interface MobileNavProps {
  currentView: View
  onViewChange: (view: View) => void
  onOpenCommand: () => void
  onOpenSettings: () => void
}

const calendarViews: { id: View; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
]

export function MobileNav({ currentView, onViewChange, onOpenCommand, onOpenSettings }: MobileNavProps) {
  const [viewsOpen, setViewsOpen] = useState(false)
  const viewsRef = useRef<HTMLDivElement>(null)
  const selectedView = calendarViews.find((item) => item.id === currentView)

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!viewsRef.current?.contains(event.target as Node)) setViewsOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutsideClick)
    return () => document.removeEventListener("mousedown", closeOnOutsideClick)
  }, [])

  return (
    <>
      {/* Floating Search Button */}
      <button
        onClick={onOpenCommand}
        className="fixed bottom-24 right-4 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors md:hidden z-40"
        title="Search"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-2 py-1 md:hidden z-50">
        <div className="flex items-center justify-around">
          <div ref={viewsRef} className="relative">
            <button
              type="button"
              onClick={() => setViewsOpen((open) => !open)}
              className={`flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs transition-colors ${calendarViews.some((item) => item.id === currentView) ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"}`}
              aria-haspopup="menu"
              aria-expanded={viewsOpen}
            >
              <CalendarDays className="h-5 w-5" />
              <span className="flex items-center gap-0.5 font-serif">
                {selectedView?.label ?? "Daily"}<ChevronDown className="h-3 w-3" />
              </span>
            </button>
            {viewsOpen && (
              <div className="absolute bottom-full left-0 mb-2 min-w-[150px] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                {calendarViews.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onViewChange(item.id)
                      setViewsOpen(false)
                    }}
                    className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${currentView === item.id ? "bg-accent text-accent-foreground" : ""}`}
                    role="menuitem"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onViewChange("habits")}
            className={`flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs transition-colors ${currentView === "habits" ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <CheckSquare className="h-5 w-5" />
            <span className="font-serif">Habits</span>
          </button>
          <button
            type="button"
            onClick={() => onViewChange("collections")}
            className={`flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs transition-colors ${currentView === "collections" ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="h-5 w-5" />
            <span className="font-serif">Collections</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[50px] text-muted-foreground hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs font-serif">Settings</span>
          </button>
        </div>
      </nav>
    </>
  )
}
