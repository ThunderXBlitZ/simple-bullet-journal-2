"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { GOOGLE_SYNC_ENABLED, GOOGLE_CONFIG } from "@/lib/journal-store"
import { signInWithGoogle } from "@/lib/google/auth"
import { toast } from "sonner"

interface SetupModalProps {
  open: boolean
  onComplete: (authMethod: "guest" | "google", name: string, googleData?: any) => void | Promise<void>
}

type Step = "auth-choice" | "name-entry"

export function SetupModal({ open, onComplete }: SetupModalProps) {
  const [step, setStep] = useState<Step>("auth-choice")
  const [name, setName] = useState("")
  const [authMethod, setAuthMethod] = useState<"guest" | "google">("guest")
  const [googleData, setGoogleData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("auth-choice")
      setName("")
      setAuthMethod("guest")
      setGoogleData(null)
      setIsLoading(false)
    }
  }, [open])

  const handleGuestClick = () => {
    setAuthMethod("guest")
    setStep("name-entry")
  }

  const handleGoogleClick = async () => {
    if (!GOOGLE_SYNC_ENABLED || !GOOGLE_CONFIG.clientId) {
      toast.error("Google Sign-In is not configured")
      return
    }

    setIsLoading(true)
    try {
      const user = await signInWithGoogle()
      setGoogleData(user)
      setAuthMethod("google")
      setName(user.given_name || user.name) // Prefill with Google name
      setStep("name-entry")
    } catch (error) {
      console.error("Google sign-in failed:", error)
      toast.error("Failed to sign in with Google")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNameSubmit = () => {
    if (name.trim()) {
      onComplete(authMethod, name.trim(), googleData)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleNameSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        {step === "auth-choice" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Welcome to Your Bullet Journal</DialogTitle>
              <DialogDescription className="font-serif text-base pt-2">
                Choose how you'd like to get started
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Button
                onClick={handleGuestClick}
                variant="outline"
                className="w-full h-auto py-3"
                disabled={isLoading}
              >
                <div className="text-left">
                  <div className="font-medium">Continue as Guest</div>
                  <div className="text-sm text-muted-foreground">Your data stays local on this device</div>
                </div>
              </Button>

              {GOOGLE_SYNC_ENABLED && (
                <Button
                  onClick={handleGoogleClick}
                  variant="outline"
                  className="w-full h-auto py-3"
                  disabled={isLoading || !GOOGLE_CONFIG.clientId}
                >
                  <div className="text-left">
                    <div className="font-medium">Sign in with Google</div>
                    <div className="text-sm text-muted-foreground">Sync your journal to Google Drive</div>
                  </div>
                </Button>
              )}
            </div>
          </>
        )}

        {step === "name-entry" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">What's your name?</DialogTitle>
              <DialogDescription className="font-serif text-base pt-2">
                {authMethod === "google"
                  ? "Your Google name is pre-filled, but you can change it"
                  : "We'll personalize your journal just for you"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="font-serif text-base"
                disabled={isLoading}
              />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("auth-choice")}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNameSubmit}
                  disabled={!name.trim() || isLoading}
                  className="flex-1"
                  size="lg"
                >
                  Get Started
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
