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
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Backup</h3>
      <p className="text-xs text-muted-foreground">Export your journal as JSON, or merge a backup back in.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadBackup}><Download className="w-4 h-4 mr-2" />Export JSON</Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Import JSON</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  )
}
