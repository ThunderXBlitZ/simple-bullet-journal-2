"use client"

import type React from "react"
import { Suspense, useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { routes, viewFromPath, type View } from "@/lib/routes"
import { XIcon } from "@/components/icons/x"
import { Sidebar } from "@/components/journal/sidebar"
import { MobileNav } from "@/components/journal/mobile-nav"
import { CommandPalette } from "@/components/journal/command-palette"
import { SetupModal } from "@/components/journal/setup-modal"
import { SettingsModal } from "@/components/journal/settings-modal"
import { SyncBanner } from "@/components/journal/sync-banner"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { migrateLegacyStores } from "@/lib/storage/legacy-migration"
import { onRemoteWrite } from "@/lib/storage/cross-tab"
import { googleAuth } from "@/lib/google/auth"
import { startAutoSync, syncNow } from "@/lib/sync/engine"
import { useSyncStatus } from "@/lib/sync/status"
import { GOOGLE_CLIENT_ID } from "@/lib/google/config"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const currentView = viewFromPath(usePathname())
  const setCurrentView = (view: View) => router.push(routes[view]())
  const [commandOpen, setCommandOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { settings, toggleSetting, userName, setUserName } = useJournalStore(useShallow((s) => ({ settings: s.settings, toggleSetting: s.toggleSetting, userName: s.userName, setUserName: s.setUserName })))

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
      if (cancelled) return
      stop = startAutoSync()
      if (useJournalStore.getState().syncAccountId) void syncNow()
    })()
    return () => {
      cancelled = true
      stop()
    }
  }, [mounted])

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
            onOpenCollection={(id) => router.push(routes.collection(id))}
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
          <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full"><Suspense>{children}</Suspense></div>
        </main>
      </div>

      {/* Mobile Navigation */}
      {!settings.focusMode && (
        <MobileNav
          currentView={currentView}
          onViewChange={setCurrentView}
          onOpenCommand={() => setCommandOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onNavigate={(view, target) => {
          if (view === "daily") router.push(routes.daily(target?.date))
          else if (view === "collections" && target?.collectionId) router.push(routes.collection(target.collectionId))
          else router.push(routes[view as View]())
        }}
      />

      {/* Focus Mode Exit Button */}
      {settings.focusMode && (
        <button
          onClick={() => toggleSetting("focusMode")}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
          title="Exit focus mode"
          aria-label="Exit Focus Mode"
        >
          <XIcon size={24} />
        </button>
      )}

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
