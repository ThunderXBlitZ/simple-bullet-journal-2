"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"
import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  List,
  Moon,
  Sun,
  Menu,
  ChevronLeft,
  Command,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Settings,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useJournalStore } from "@/lib/journal-store"
import { cn } from "@/lib/utils"

type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  onOpenCommand: () => void
  onOpenSettings: () => void
  className?: string
}

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "daily", label: "Daily Log", icon: <CalendarDays className="w-4 h-4" /> },
  { id: "weekly", label: "Weekly", icon: <CalendarRange className="w-4 h-4" /> },
  { id: "monthly", label: "Monthly", icon: <CalendarDays className="w-4 h-4" /> },
  { id: "habits", label: "Habits", icon: <CheckSquare className="w-4 h-4" /> },
  { id: "collections", label: "Collections", icon: <List className="w-4 h-4" /> },
]

export function Sidebar({ currentView, onViewChange, onOpenCommand, onOpenSettings, className }: SidebarProps) {
  const { theme, setTheme } = useTheme()
  const { settings, toggleSetting, setZoom, collections } = useJournalStore()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const zoomIn = () => setZoom(settings.zoomLevel + 0.1)
  const zoomOut = () => setZoom(settings.zoomLevel - 0.1)

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
            {useJournalStore().userName}'s Bullet Journal
          </h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-foreground"
        >
          {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
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
              <div key={collection.id} className="text-sm text-sidebar-foreground/70 py-1 px-2 truncate">
                {collection.icon} {collection.name}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
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
          onClick={() => toggleSetting("focusMode")}
        >
          {settings.focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {!isCollapsed && <span className="font-serif">Focus Mode</span>}
        </Button>

        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-3 text-sidebar-foreground text-sm", isCollapsed && "justify-center")}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!isCollapsed && <span className="font-serif">{theme === "dark" ? "Light" : "Dark"}</span>}
        </Button>

        <Button
          variant="ghost"
          className={cn("w-full justify-start gap-3 text-sidebar-foreground text-sm", isCollapsed && "justify-center")}
          onClick={onOpenSettings}
        >
          <Settings className="w-4 h-4" />
          {!isCollapsed && <span className="font-serif">Settings</span>}
        </Button>

        {/* Zoom Controls */}
        <div className={cn("flex gap-1", isCollapsed ? "flex-col items-center" : " justify-center gap-1")}>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={zoomOut}
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </Button>
          {!isCollapsed && (
            <div className="flex items-center justify-center text-xs text-sidebar-foreground">
              {Math.round(settings.zoomLevel * 100)}%
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={zoomIn}
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Date */}
      {!isCollapsed && (
        <div className="p-4 text-center text-xs text-sidebar-foreground/60 font-serif">
          {format(new Date(), "MMMM yyyy")}
        </div>
      )}
    </aside>
  )
}
