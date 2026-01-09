"use client"

import type React from "react"

import { CalendarDays, CalendarRange, CheckSquare, List, Search } from "lucide-react"
import { cn } from "@/lib/utils"

type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

interface MobileNavProps {
  currentView: View
  onViewChange: (view: View) => void
  onOpenCommand: () => void
}

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "daily", label: "Daily", icon: <CalendarDays className="w-5 h-5" /> },
  { id: "weekly", label: "Weekly", icon: <CalendarRange className="w-5 h-5" /> },
  { id: "habits", label: "Habits", icon: <CheckSquare className="w-5 h-5" /> },
  { id: "collections", label: "Lists", icon: <List className="w-5 h-5" /> },
]

export function MobileNav({ currentView, onViewChange, onOpenCommand }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-2 py-1 md:hidden z-50">
      <div className="flex items-center justify-around">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[60px]",
              currentView === item.id ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.icon}
            <span className="text-xs font-serif">{item.label}</span>
          </button>
        ))}
        <button
          onClick={onOpenCommand}
          className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <Search className="w-5 h-5" />
          <span className="text-xs font-serif">Search</span>
        </button>
      </div>
    </nav>
  )
}
