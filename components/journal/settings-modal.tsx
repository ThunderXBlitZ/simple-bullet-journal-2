"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useJournalStore } from "@/lib/journal-store"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const { userName, setUserName } = useJournalStore()
  const [nameInput, setNameInput] = useState(userName)

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setUserName(nameInput.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveName()
    }
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
