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
import { SyncBanner } from "@/components/journal/sync-banner"
import { useJournalStore } from "@/lib/journal-store"
import { migrateLegacyStores } from "@/lib/storage/legacy-migration"
import { onRemoteWrite } from "@/lib/storage/cross-tab"
import { googleAuth } from "@/lib/google/auth"
import { startAutoSync, syncNow } from "@/lib/sync/engine"
import { useSyncStatus } from "@/lib/sync/status"
import { GOOGLE_CLIENT_ID } from "@/lib/google/config"
import { cn } from "@/lib/utils"

type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [currentView, setCurrentView] = useState<View>("daily")
  const [commandOpen, setCommandOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { settings, toggleSetting, userName, setUserName } = useJournalStore()

  // Migrate legacy stores, rehydrate, then mark mounted. Until this fires,
  // both server and client render the same empty shell (no mismatch).
  useEffect(() => {
    const init = async () => {
      await migrateLegacyStores()
      await useJournalStore.persist.rehydrate()
      setMounted(true)
    }
    init()
    return onRemoteWrite(() => { useJournalStore.persist.rehydrate() })
  }, [])

  // Apply zoom to root font size for proper scaling
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.zoomLevel * 100}%`
  }, [settings.zoomLevel])

  // Google auth restore + background sync
  useEffect(() => {
    if (!mounted || !GOOGLE_CLIENT_ID) return
    let stop: () => void = () => {}
    let cancelled = false
    ;(async () => {
      await useSyncStatus.getState().loadLastSync()
      try {
        await googleAuth.init()
      } catch {
        return // offline / blocked: local-only until next load
      }
      await googleAuth.restore()
      if (cancelled) return
      stop = startAutoSync()
      if (useJournalStore.getState().syncAccountId) void syncNow()
    })()
    return () => {
      cancelled = true
      stop()
    }
  }, [mounted])

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setCurrentView("daily")
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

  if (!mounted) {
    return <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden" />
  }

  if (!userName) {
    return (
      <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
        <SetupModal open={true} onComplete={setUserName} />
      </div>
    )
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

      {/* Content column (sync banner spans this column, not the sidebar) */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <SyncBanner />

        <main
          className={cn(
            "flex-1 overflow-hidden flex flex-col",
            "p-4 md:p-8",
            "pb-16 md:pb-8", // Extra padding for mobile nav
          )}
        >
          <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full">{renderView()}</div>
        </main>
      </div>

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

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
