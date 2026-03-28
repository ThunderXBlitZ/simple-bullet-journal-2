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
import { useJournalStore, GOOGLE_SYNC_ENABLED, GOOGLE_CONFIG, generateGuestId } from "@/lib/journal-store"
import { initializeGoogle, setAccessToken } from "@/lib/google/auth"
import { debouncedSync, cancelSync } from "@/lib/google/auto-sync"
import {
  setActiveStorageKey,
  clearActiveStorageKey,
  getPersistedActiveKey,
  persistGuestId,
  getPersistedGuestId,
  registerUser,
} from "@/lib/storage/zustand-adapter"
import { cn } from "@/lib/utils"

type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [currentView, setCurrentView] = useState<View>("daily")
  const [commandOpen, setCommandOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { settings, toggleSetting, userName, setUserName, authMethod, accessToken, setGoogleUser, setAuthMethod } =
    useJournalStore()

  // Mark as mounted and rehydrate store — until this fires,
  // both server and client render the same empty shell (no mismatch)
  useEffect(() => {
    const initializeApp = async () => {
      // Priority 1: restore the active session key (set on login, cleared on logout)
      const savedKey = await getPersistedActiveKey()
      if (savedKey) {
        setActiveStorageKey(savedKey)
      } else {
        // Priority 2: returning guest — they logged out but their identity persists
        const savedGuestId = await getPersistedGuestId()
        if (savedGuestId) {
          setActiveStorageKey(`bj-guest-${savedGuestId}`)
        }
        // If neither exists: first-time user — rehydrate gets empty state, SetupModal shows
      }

      await useJournalStore.persist.rehydrate()
      setMounted(true)
    }
    initializeApp()
  }, [])

  // Initialize Google Sign-In on app load
  useEffect(() => {
    const initGoogle = async () => {
      if (GOOGLE_SYNC_ENABLED && GOOGLE_CONFIG.clientId) {
        try {
          await initializeGoogle(GOOGLE_CONFIG as { clientId: string; scope: string[] })
          // Restore access token if it exists
          if (accessToken) {
            setAccessToken(accessToken)
          }
        } catch (error) {
          console.error("Failed to initialize Google:", error)
        }
      }
    }

    initGoogle()
  }, [accessToken])

  // Setup auto-sync subscription
  useEffect(() => {
    if (!GOOGLE_SYNC_ENABLED) {
      return
    }

    // Subscribe to store changes and trigger debounced sync
    const unsubscribe = useJournalStore.subscribe(() => {
      // Trigger debounced sync on any state change
      debouncedSync()
    })

    // Cleanup on unmount
    return () => {
      unsubscribe()
      cancelSync()
    }
  }, [])

  // Apply zoom to root font size for proper scaling
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.zoomLevel * 100}%`
  }, [settings.zoomLevel])

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setCurrentView("daily")
  }

  const handleSetupComplete = async (authMethod: "guest" | "google", name: string, googleData?: any) => {
    if (authMethod === "google" && googleData) {
      const userKey = `bj-google-${googleData.id}`
      // Set storage key BEFORE store writes for Google users
      setActiveStorageKey(userKey)
      setGoogleUser(googleData.id, googleData.email, "", "")
      await registerUser(userKey, name, "google")
    } else {
      // Guest mode: use persisted ID if this is a returning guest,
      // otherwise generate a fresh one
      const existingGuestId = await getPersistedGuestId()
      const guestId = existingGuestId ?? generateGuestId()
      const userKey = `bj-guest-${guestId}`
      setActiveStorageKey(userKey)
      persistGuestId(guestId) // survives future logouts
      useJournalStore.setState({ guestId })
      setAuthMethod("guest")
      await registerUser(userKey, name, "guest")
    }

    setUserName(name)
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

  // Until client-side hydration completes, render an empty shell so
  // server HTML and first client render are identical (no hydration mismatch).
  // This app is fully client-side (localStorage/IndexedDB) so SSR content has no value.
  if (!mounted) {
    return <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden" />
  }

  // Don't render journal content until user is logged in
  // This prevents data leakage of previous users' data
  if (!userName) {
    return (
      <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
        <SetupModal open={true} onComplete={handleSetupComplete} />
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

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
