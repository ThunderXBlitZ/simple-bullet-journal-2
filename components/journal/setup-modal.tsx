"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { connectGoogle } from "@/lib/sync/link"
import { GOOGLE_CLIENT_ID } from "@/lib/google/config"
import { toast } from "sonner"

interface SetupModalProps {
  open: boolean
  onComplete: (name: string) => void
}

export function SetupModal({ open, onComplete }: SetupModalProps) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = () => name.trim() && onComplete(name.trim())

  const restore = async () => {
    setBusy(true)
    try {
      await connectGoogle()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Welcome to your journal</DialogTitle>
          <DialogDescription>What should we call you? You can change it later in Settings.</DialogDescription>
        </DialogHeader>
        <Input autoFocus autoComplete="off" name="journal-owner" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Your name" />
        <Button onClick={submit} disabled={!name.trim()}>Start journaling</Button>
        {GOOGLE_CLIENT_ID && (
          <Button variant="outline" onClick={restore} disabled={busy}>Restore from Google Drive</Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
