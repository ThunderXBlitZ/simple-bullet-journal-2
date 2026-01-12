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
  { id: "monthly", label: "Monthly", icon: <CalendarDays className="w-5 h-5" /> },
  { id: "habits", label: "Habits", icon: <CheckSquare className="w-5 h-5" /> },
  { id: "collections", label: "Collections", icon: <List className="w-5 h-5" /> },
]

export function MobileNav({ currentView, onViewChange, onOpenCommand }: MobileNavProps) {
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
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors min-w-[50px]",
                currentView === item.id ? "text-primary bg-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.icon}
              <span className="text-xs font-serif">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
