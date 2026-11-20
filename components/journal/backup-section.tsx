"use client"

import { useRef } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { downloadBackup, importBackup } from "@/lib/backup"

export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      importBackup(await file.text(), "merge")
      toast.success("Backup merged into your journal")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium font-serif">Export / import (JSON)</label>
        <div className="flex gap-2">
        <Button variant="outline" size="icon" aria-label="Export JSON" onClick={downloadBackup}><Download className="w-4 h-4" /></Button>
        <Button variant="outline" size="icon" aria-label="Import JSON" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" /></Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
    </div>
  )
}
