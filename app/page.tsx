"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Sidebar } from "@/components/journal/sidebar"
import { MobileNav } from "@/components/journal/mobile-nav"
import { DailyLog } from "@/components/journal/daily-log"
import { WeeklyView } from "@/components/journal/weekly-view"
import { MonthlyView } from "@/components/journal/monthly-view"
import { HabitTracker } from "@/components/journal/habit-tracker"
import { CollectionsView } from "@/components/journal/collections-view"
import { CommandPalette } from "@/components/journal/command-palette"
import { SetupModal } from "@/components/journal/setup-modal"
import { SettingsModal } from "@/components/journal/settings-modal"
import { useJournalStore } from "@/lib/journal-store"
import { cn } from "@/lib/utils"

type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

export default function Home() {
  const [currentView, setCurrentView] = useState<View>("daily")
  const [commandOpen, setCommandOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { settings, toggleSetting, userName, setUserName } = useJournalStore()

  // Apply zoom to root font size for proper scaling
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.zoomLevel * 100}%`
  }, [settings.zoomLevel])

  // Show setup modal on first visit
  useEffect(() => {
    if (!userName) {
      setShowSetupModal(true)
    }
  }, [])

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setCurrentView("daily")
  }

  const handleSetupComplete = (name: string) => {
    setUserName(name)
    setShowSetupModal(false)
  }

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
        return <DailyLog initialDate={selectedDate} />
      case "weekly":
        return <WeeklyView onDateClick={handleDateClick} />
      case "monthly":
        return <MonthlyView onDateClick={handleDateClick} />
      case "habits":
        return <HabitTracker />
      case "collections":
        return <CollectionsView />
      default:
        return <DailyLog initialDate={selectedDate} />
    }
  }

  return (
    <div className={cn("flex flex-col md:flex-row h-screen bg-background overflow-hidden", settings.showDots && "dotted-bg")}>
      {/* Desktop Sidebar */}
      {!settings.focusMode && (
        <div className="hidden md:flex md:flex-col">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            onOpenCommand={() => setCommandOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
      )}

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 overflow-hidden flex flex-col",
          "p-4 md:p-8",
          "pb-16 md:pb-8", // Extra padding for mobile nav
        )}
      >
        <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full">{renderView()}</div>
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

      {/* Focus Mode Exit Button */}
      {settings.focusMode && (
        <button
          onClick={() => toggleSetting("focusMode")}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
          title="Exit Focus Mode (Cmd+K)"
          aria-label="Exit Focus Mode"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Setup Modal */}
      <SetupModal open={showSetupModal} onSubmit={handleSetupComplete} />

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
