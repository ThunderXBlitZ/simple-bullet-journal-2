"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarRange, CheckSquare, List, Menu, Command, Settings } from "lucide-react"
import { SettingsIcon } from "@/components/icons/settings"
import { CalendarDaysIcon } from "@/components/icons/calendar-days"
import { ChevronLeftIcon } from "@/components/icons/chevron-left"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import { JournalIcon } from "@/components/journal/journal-icon"

import type { View } from "@/lib/routes"

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  onOpenCommand: () => void
  onOpenSettings: () => void
  onOpenCollection: (id: string) => void
  className?: string
}

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "daily", label: "Daily Log", icon: <CalendarDaysIcon size={16} /> },
  { id: "weekly", label: "Weekly", icon: <CalendarRange className="w-4 h-4" /> },
  { id: "monthly", label: "Monthly", icon: <CalendarDaysIcon size={16} /> },
  { id: "habits", label: "Habits", icon: <CheckSquare className="w-4 h-4" /> },
  { id: "collections", label: "Collections", icon: <List className="w-4 h-4" /> },
]

export function Sidebar({ currentView, onViewChange, onOpenCommand, onOpenSettings, onOpenCollection, className }: SidebarProps) {
  const { collections, userName } = useJournalStore(useShallow((s) => ({ collections: s.collections, userName: s.userName })))
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [currentMonth, setCurrentMonth] = useState("")

  useEffect(() => {
    setCurrentMonth(format(new Date(), "MMMM yyyy"))
  }, [])

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300",
        isCollapsed ? "w-16" : "w-56",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <h1 className="font-serif text-lg font-semibold text-sidebar-foreground">
            <button type="button" onClick={onOpenSettings} className="text-left cursor-pointer">
              {userName}'s<br />Bullet Journal
            </button>
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-foreground"
        >
          {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeftIcon size={16} />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={currentView === item.id ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start gap-3 text-sidebar-foreground",
              currentView === item.id && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
            onClick={() => onViewChange(item.id)}
          >
            {item.icon}
            {!isCollapsed && <span className="font-serif">{item.label}</span>}
          </Button>
        ))}

        {/* Collections submenu */}
        {currentView === "collections" && !isCollapsed && collections.length > 0 && (
          <div className="pl-7 space-y-1 mt-1">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => onOpenCollection(collection.id)}
                className="block w-full text-left text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground py-1 px-2 truncate cursor-pointer"
              >
                <JournalIcon name={collection.icon} size={14} className="mr-1.5 align-text-bottom" />{collection.name}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-3 text-sidebar-foreground text-sm", isCollapsed && "justify-center")}
          onClick={onOpenCommand}
        >
          <Command className="w-4 h-4" />
          {!isCollapsed && (
            <>
              <span className="font-serif">Search</span>
              <kbd className="ml-auto text-xs bg-sidebar-accent px-1.5 py-0.5 rounded">⌘K</kbd>
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-3 text-sidebar-foreground text-sm", isCollapsed && "justify-center")}
          onClick={onOpenSettings}
        >
          <SettingsIcon size={16} />
          {!isCollapsed && <span className="font-serif">Settings</span>}
        </Button>

      </div>

      {/* Date */}
      {!isCollapsed && (
        <div className="p-4 text-center text-xs text-sidebar-foreground/60 font-serif">
          {currentMonth}
        </div>
      )}
    </aside>
  )
}
