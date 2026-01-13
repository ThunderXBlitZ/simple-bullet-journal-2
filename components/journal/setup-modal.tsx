"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SetupModalProps {
  open: boolean
  onSubmit: (name: string) => void
}

export function SetupModal({ open, onSubmit }: SetupModalProps) {
  const [name, setName] = useState("")

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Welcome to Your Bullet Journal</DialogTitle>
          <DialogDescription className="font-serif text-base pt-2">
            What's your name? We'll personalize your journal just for you.
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
          />

          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full"
            size="lg"
          >
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
