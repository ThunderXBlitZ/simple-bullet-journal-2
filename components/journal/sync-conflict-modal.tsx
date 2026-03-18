"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AlertCircle } from "lucide-react"
import type { MergeStrategy, DataSummary } from "@/lib/google/conflict-resolution"

interface SyncConflictModalProps {
  open: boolean
  localSummary: DataSummary
  driveSummary: DataSummary | null
  onResolve: (strategy: MergeStrategy) => void
  isLoading?: boolean
}

export function SyncConflictModal({
  open,
  localSummary,
  driveSummary,
  onResolve,
  isLoading = false,
}: SyncConflictModalProps) {
  const hasConflict = localSummary.hasData && driveSummary?.hasData
  const [selectedStrategy, setSelectedStrategy] = React.useState<MergeStrategy>("keep-both")

  const DataSummaryRow = ({ label, local, drive }: { label: string; local: number; drive?: number }) => (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-6">
        {drive !== undefined && <span className="w-16 text-right">{drive} on Drive</span>}
        <span className="w-16 text-right">{local} local</span>
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Sync Your Data</DialogTitle>
          <DialogDescription className="font-serif text-base pt-2">
            {hasConflict
              ? "We found data on both your device and Google Drive. Choose how to proceed:"
              : "Your local data will sync to Google Drive"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Data Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="font-medium text-sm mb-3">Data Summary</div>
            {driveSummary && (
              <>
                <DataSummaryRow label="Daily logs" local={localSummary.dailyLogsCount} drive={driveSummary.dailyLogsCount} />
                <DataSummaryRow label="Total entries" local={localSummary.entriesCount} drive={driveSummary.entriesCount} />
                <DataSummaryRow label="Tags" local={localSummary.tagsCount} drive={driveSummary.tagsCount} />
                <DataSummaryRow label="Habits" local={localSummary.habitsCount} drive={driveSummary.habitsCount} />
                <DataSummaryRow label="Collections" local={localSummary.collectionsCount} drive={driveSummary.collectionsCount} />
              </>
            )}
            {!driveSummary && (
              <>
                <DataSummaryRow label="Daily logs" local={localSummary.dailyLogsCount} />
                <DataSummaryRow label="Total entries" local={localSummary.entriesCount} />
                <DataSummaryRow label="Tags" local={localSummary.tagsCount} />
                <DataSummaryRow label="Habits" local={localSummary.habitsCount} />
                <DataSummaryRow label="Collections" local={localSummary.collectionsCount} />
              </>
            )}
          </div>

          {/* Conflict Warning */}
          {hasConflict && (
            <div className="flex gap-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                You have data in both places. Choose below to avoid losing any information.
              </div>
            </div>
          )}

          {/* Strategy Selection */}
          <RadioGroup value={selectedStrategy} onValueChange={(value) => setSelectedStrategy(value as MergeStrategy)}>
            <div className="space-y-3">
              {/* Keep Both Option */}
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelectedStrategy('keep-both')}>
                <RadioGroupItem value="keep-both" id="keep-both" className="mt-1" />
                <Label htmlFor="keep-both" className="flex-1 cursor-pointer">
                  <div className="font-medium">Keep Both</div>
                  <div className="text-sm text-muted-foreground">
                    Merge data from both places. Missing items from Drive will be added. (Recommended)
                  </div>
                </Label>
              </div>

              {/* Use Local Only Option */}
              <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelectedStrategy('local-only')}>
                <RadioGroupItem value="local-only" id="local-only" className="mt-1" />
                <Label htmlFor="local-only" className="flex-1 cursor-pointer">
                  <div className="font-medium">Use Local Only</div>
                  <div className="text-sm text-muted-foreground">
                    Keep only your device data. Google Drive will be replaced. {driveSummary && `You'll lose ${driveSummary.entriesCount} entries on Drive.`}
                  </div>
                </Label>
              </div>

              {/* Use Drive Only Option */}
              {driveSummary && driveSummary.hasData && (
                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setSelectedStrategy('drive-only')}>
                  <RadioGroupItem value="drive-only" id="drive-only" className="mt-1" />
                  <Label htmlFor="drive-only" className="flex-1 cursor-pointer">
                    <div className="font-medium">Use Google Drive Data</div>
                    <div className="text-sm text-muted-foreground">
                      Replace local data with Drive. You'll lose {localSummary.entriesCount} local entries.
                    </div>
                  </Label>
                </div>
              )}
            </div>
          </RadioGroup>

          <Separator />

          {/* Action Button */}
          <Button
            onClick={() => onResolve(selectedStrategy)}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? "Merging..." : "Continue"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You can undo this action in the next 10 seconds
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
