"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { LogOut, Maximize2, Minus, Minimize2, Moon, Plus, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useJournalStore } from "@/lib/journal-store"
import { googleAuth } from "@/lib/google/auth"
import { SyncSection } from "./sync-section"
import { BackupSection } from "./backup-section"
import { toast } from "sonner"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const { userName, setUserName, resetStore, settings, toggleSetting, setZoom } = useJournalStore()
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
    googleAuth.signOut()
    resetStore()
    onOpenChange(false)
    toast.success("Logged out")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Your Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium font-serif">Your Name</label>
            <Input
              type="text"
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
              size="sm"
            >
              Save Name
            </Button>
          </div>

          <Separator />

          {/* Journal display */}
          <div className="space-y-3">
            <label className="text-sm font-medium font-serif">Journal Display</label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSetting("focusMode")}
              className="w-full justify-start gap-2"
            >
              {settings.focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {settings.focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
            </Button>
            <div className="flex items-center justify-between">
              <span className="text-sm">Zoom</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom(settings.zoomLevel - 0.1)}
                  aria-label="Zoom out"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-12 text-center text-sm">{Math.round(settings.zoomLevel * 100)}%</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom(settings.zoomLevel + 0.1)}
                  aria-label="Zoom in"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Theme */}
          <div className="space-y-2">
            <label className="text-sm font-medium font-serif">Appearance</label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="flex items-center gap-2"
              >
                <Sun className="w-4 h-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="flex items-center gap-2"
              >
                <Moon className="w-4 h-4" />
                Dark
              </Button>
            </div>
          </div>

          <Separator />

          <SyncSection />

          <Separator />

          <BackupSection />

          <Separator />

          {/* Logout */}
          <Button onClick={handleLogout} variant="destructive" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
