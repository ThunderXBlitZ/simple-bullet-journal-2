"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Minus } from "lucide-react"
import { LogoutIcon } from "@/components/icons/logout"
import { Maximize2Icon } from "@/components/icons/maximize-2"
import { MinimizeIcon } from "@/components/icons/minimize"
import { MoonIcon } from "@/components/icons/moon"
import { PlusIcon } from "@/components/icons/plus"
import { SunIcon } from "@/components/icons/sun"
import { CheckIcon } from "@/components/icons/check"
import { useTheme } from "next-themes"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { googleAuth } from "@/lib/google/auth"
import { SyncSection } from "./sync-section"
import { BackupSection } from "./backup-section"
import { toast } from "sonner"
import { downloadBackup } from "@/lib/backup"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const { userName, setUserName, resetStore, settings, toggleSetting, setZoom, syncAccountId } = useJournalStore(useShallow((s) => ({ userName: s.userName, setUserName: s.setUserName, resetStore: s.resetStore, settings: s.settings, toggleSetting: s.toggleSetting, setZoom: s.setZoom, syncAccountId: s.syncAccountId })))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [nameInput, setNameInput] = useState(userName)

  useEffect(() => {
    setNameInput(userName)
  }, [userName])

  const handleSaveName = () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setUserName(trimmed)
    toast.success("Name saved!")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSaveName()
  }

  const handleLogout = () => {
    if (syncAccountId) googleAuth.signOut() // linked: revoke Google session; guest: nothing to revoke
    resetStore() // clears local journal + link in both cases
    setConfirmOpen(false)
    onOpenChange(false)
    toast.success("Logged out")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-7">
          {/* Your Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium font-serif">Your Name</label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                autoComplete="off"
                placeholder="Enter your name..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="font-serif text-base"
              />
              <Button
                onClick={handleSaveName}
                disabled={!nameInput.trim() || nameInput === userName}
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="Save name"
              >
                <CheckIcon size={16} />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Display: focus, zoom, theme in one row */}
          <div className="space-y-3">
            <label className="text-sm font-medium font-serif">Display</label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="group relative justify-self-start">
              <Button
                variant={settings.focusMode ? "default" : "outline"}
                size="icon"
                onClick={() => toggleSetting("focusMode")}
                aria-label={settings.focusMode ? "Exit focus mode" : "Enter focus mode"}
              >
                {settings.focusMode ? <MinimizeIcon size={16} /> : <Maximize2Icon size={16} />}
              </Button>
              <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-50 mt-1 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 transition-opacity group-hover:opacity-100">
                Focus mode
              </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setZoom(settings.zoomLevel - 0.1)} aria-label="Zoom out">
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-12 text-center text-sm">{Math.round(settings.zoomLevel * 100)}%</span>
                <Button variant="outline" size="icon" onClick={() => setZoom(settings.zoomLevel + 0.1)} aria-label="Zoom in">
                  <PlusIcon size={16} />
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="justify-self-end"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle dark mode"
                title="Dark / light"
              >
                {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Data: sync + backup */}
          <div className="space-y-4">
            <SyncSection />
            <BackupSection />
          </div>

          <Separator />

          {/* Logout */}
          <Button onClick={() => setConfirmOpen(true)} variant="destructive" className="w-full">
            <LogoutIcon size={16} className="mr-2" />
            Log out
          </Button>
        </div>
      </DialogContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Log out?</DialogTitle>
            <DialogDescription>
              {syncAccountId
                ? "Your journal stays safe in Google Drive. Local data on this device will be cleared; sign in again to restore it."
                : "You are not linked to Google. Logging out will permanently delete all journal data on this device."}
            </DialogDescription>
          </DialogHeader>
          {!syncAccountId && (
            <Button variant="outline" onClick={downloadBackup}>Export backup first</Button>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleLogout}>Log out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
