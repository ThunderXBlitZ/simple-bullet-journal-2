"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/journal/sidebar"
import { MobileNav } from "@/components/journal/mobile-nav"
import { DailyLog } from "@/components/journal/daily-log"
import { WeeklyView } from "@/components/journal/weekly-view"
import { MonthlyView } from "@/components/journal/monthly-view"
import { HabitTracker } from "@/components/journal/habit-tracker"
import { CollectionsView } from "@/components/journal/collections-view"
import { CommandPalette } from "@/components/journal/command-palette"
import { useJournalStore } from "@/lib/journal-store"
import { cn } from "@/lib/utils"

type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("daily")
  const [commandOpen, setCommandOpen] = useState(false)
  const { settings } = useJournalStore()

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const renderView = () => {
    switch (currentView) {
      case "daily":
        return <DailyLog />
      case "weekly":
        return <WeeklyView />
      case "monthly":
        return <MonthlyView />
      case "habits":
        return <HabitTracker />
      case "collections":
        return <CollectionsView />
      default:
        return <DailyLog />
    }
  }

  return (
    <div className={cn("flex h-screen bg-background overflow-hidden", settings.showDots && "dotted-bg")}>
      {/* Desktop Sidebar */}
      {!settings.focusMode && (
        <div className="hidden md:block">
          <Sidebar currentView={currentView} onViewChange={setCurrentView} onOpenCommand={() => setCommandOpen(true)} />
        </div>
      )}

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 overflow-hidden",
          "p-4 md:p-8",
          "pb-20 md:pb-8", // Extra padding for mobile nav
        )}
      >
        <div className="h-full max-w-4xl mx-auto">{renderView()}</div>
      </main>

      {/* Mobile Navigation */}
      {!settings.focusMode && (
        <MobileNav currentView={currentView} onViewChange={setCurrentView} onOpenCommand={() => setCommandOpen(true)} />
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={(view) => {
          setCurrentView(view as View)
          setCommandOpen(false)
        }}
      />
    </div>
  )
}
