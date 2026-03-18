"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Moon, Sun, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { useJournalStore, GOOGLE_SYNC_ENABLED, GOOGLE_CONFIG } from "@/lib/journal-store"
import { signInWithGoogle, signOutFromGoogle } from "@/lib/google/auth"
import { uploadToDrive, getLastSyncTime } from "@/lib/google/drive"
import {
  checkForConflicts,
  applyMergeStrategy,
  createStateBackup,
  restoreStateFromBackup,
  type MergeStrategy,
  type DataSummary,
} from "@/lib/google/conflict-resolution"
import { SyncConflictModal } from "./sync-conflict-modal"
import { toast } from "sonner"

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme()
  const {
    userName,
    setUserName,
    authMethod,
    googleEmail,
    setGoogleUser,
    clearGoogleAuth,
    googleDriveSyncEnabled,
    setGoogleDriveSyncEnabled,
    lastSyncTime,
    setLastSyncTime,
  } = useJournalStore()
  const [nameInput, setNameInput] = useState(userName)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(lastSyncTime)

  // Conflict resolution state
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [localSummary, setLocalSummary] = useState<DataSummary | null>(null)
  const [driveSummary, setDriveSummary] = useState<DataSummary | null>(null)
  const [preSignInBackup, setPreSignInBackup] = useState<string | null>(null)
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null)
  const [showUndoToast, setShowUndoToast] = useState(false)

  // Update last sync time on mount
  useEffect(() => {
    if (authMethod === "google" && googleDriveSyncEnabled) {
      getLastSyncTime().then((time) => {
        if (time) {
          setLastSync(time.toISOString())
        }
      })
    }
  }, [authMethod, googleDriveSyncEnabled])

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

  const handleSignInGoogle = async () => {
    if (!GOOGLE_SYNC_ENABLED || !GOOGLE_CONFIG.clientId) {
      toast.error("Google Sign-In is not configured")
      return
    }

    try {
      const user = await signInWithGoogle()
      setGoogleUser(user.id, user.email, "", "")
      toast.success("Signed in with Google!")

      // Check for conflicts between local and Drive data
      const conflict = await checkForConflicts()

      if (conflict.hasConflict) {
        // Save current state as backup for undo
        const backup = createStateBackup()
        setPreSignInBackup(backup)
        setLocalSummary(conflict.localSummary)
        setDriveSummary(conflict.driveSummary)
        setShowConflictModal(true)
      } else if (conflict.driveSummary?.hasData) {
        // No conflict but Drive has data - default to keep-both
        await handleMergeStrategy("keep-both")
      }
      // else: No data on Drive, local data will sync automatically via auto-sync
    } catch (error) {
      console.error("Google sign-in failed:", error)
      toast.error("Failed to sign in with Google")
    }
  }

  const handleMergeStrategy = async (strategy: MergeStrategy) => {
    setShowConflictModal(false)
    setIsSyncing(true)

    try {
      // Create backup before merging (for undo)
      const premergeBackup = createStateBackup()

      // Apply the merge strategy
      await applyMergeStrategy(strategy)

      // Show undo toast for 10 seconds
      setShowUndoToast(true)
      const timeout = setTimeout(() => {
        setShowUndoToast(false)
      }, 10000)
      setUndoTimeout(timeout)

      // Store pre-merge backup for undo
      setPreSignInBackup(premergeBackup)

      toast.success(`Data merged using "${strategy}" strategy`)
    } catch (error) {
      console.error("Merge failed:", error)
      toast.error("Failed to merge data")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleUndoSync = () => {
    if (!preSignInBackup) return

    restoreStateFromBackup(preSignInBackup)
    setShowUndoToast(false)

    if (undoTimeout) {
      clearTimeout(undoTimeout)
      setUndoTimeout(null)
    }

    toast.success("Sync undone. Local data restored.")
  }

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeout) {
        clearTimeout(undoTimeout)
      }
    }
  }, [undoTimeout])

  const handleSignOutGoogle = () => {
    signOutFromGoogle()
    clearGoogleAuth()
    toast.success("Signed out from Google")
  }

  const handleToggleSync = async (enabled: boolean) => {
    if (enabled && authMethod !== "google") {
      toast.error("Please sign in with Google first")
      return
    }

    setGoogleDriveSyncEnabled(enabled)

    if (enabled) {
      // Perform initial sync
      await performManualSync()
    }
  }

  const performManualSync = async () => {
    if (authMethod !== "google") {
      toast.error("Not authenticated with Google")
      return
    }

    setIsSyncing(true)
    try {
      // Get all data from store
      const store = useJournalStore.getState()
      const dataToSync = {
        dailyLogs: store.dailyLogs,
        tags: store.tags,
        habits: store.habits,
        habitCompletions: store.habitCompletions,
        collections: store.collections,
        userName: store.userName,
        settings: store.settings,
      }

      await uploadToDrive(JSON.stringify(dataToSync))
      const now = new Date().toISOString()
      setLastSyncTime(now)
      setLastSync(now)
      toast.success("Data synced to Google Drive!")
    } catch (error) {
      console.error("Sync failed:", error)
      toast.error("Failed to sync data")
    } finally {
      setIsSyncing(false)
    }
  }

  const formatLastSyncTime = (time: string | null) => {
    if (!time) return "Never"
    const date = new Date(time)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <>
      {/* Conflict Resolution Modal */}
      {localSummary && (
        <SyncConflictModal
          open={showConflictModal}
          localSummary={localSummary}
          driveSummary={driveSummary}
          onResolve={handleMergeStrategy}
          isLoading={isSyncing}
        />
      )}

      {/* Undo Toast */}
      {showUndoToast && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 bg-foreground text-background p-4 rounded-lg shadow-lg flex items-center justify-between gap-3 z-50 animate-in slide-in-from-bottom-4">
          <span className="text-sm">Data merged. You can undo this action.</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleUndoSync} className="h-8 px-2 text-xs">
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUndoToast(false)}
              className="h-8 px-2 text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

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

          {/* Google Account Section */}
          {GOOGLE_SYNC_ENABLED && (
            <>
              <Separator />

              <div className="space-y-3">
                <label className="text-sm font-medium font-serif">Google Account</label>

                {authMethod === "guest" ? (
                  <Button
                    onClick={handleSignInGoogle}
                    variant="outline"
                    className="w-full"
                    disabled={!GOOGLE_CONFIG.clientId}
                  >
                    Sign in with Google
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm">
                      <div className="font-medium">Signed in as</div>
                      <div className="text-muted-foreground">{googleEmail}</div>
                    </div>
                    <Button
                      onClick={handleSignOutGoogle}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>

              {/* Google Drive Sync Section */}
              {authMethod === "google" && (
                <>
                  <Separator />

                  <div className="space-y-3">
                    <label className="text-sm font-medium font-serif">Google Drive Sync</label>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Enable automatic sync</span>
                      <Switch
                        checked={googleDriveSyncEnabled}
                        onCheckedChange={handleToggleSync}
                        disabled={isSyncing}
                      />
                    </div>

                    {googleDriveSyncEnabled && (
                      <>
                        <div className="text-xs text-muted-foreground">
                          Last synced: {formatLastSyncTime(lastSync)}
                        </div>
                        <Button
                          onClick={performManualSync}
                          variant="outline"
                          size="sm"
                          disabled={isSyncing}
                          className="w-full"
                        >
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
