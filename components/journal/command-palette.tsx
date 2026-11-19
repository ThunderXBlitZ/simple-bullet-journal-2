"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Search } from "lucide-react"
import { useJournalStore } from "@/lib/journal-store"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: string) => void
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const { dailyLogs } = useJournalStore()
  const [search, setSearch] = useState("")

  // Search results from entries
  const searchResults = useMemo(() => {
    if (!search.trim()) return []

    const query = search.toLowerCase()
    const results: { date: string; content: string; type: string }[] = []

    Object.entries(dailyLogs).forEach(([date, log]) => {
      log.entries.forEach((entry) => {
        if (entry.content.toLowerCase().includes(query)) {
          results.push({
            date,
            content: entry.content,
            type: entry.type,
          })
        }
      })
    })

    return results.slice(0, 10)
  }, [search, dailyLogs])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search your journal..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {searchResults.length > 0 && (
          <CommandGroup heading="Search Results">
            {searchResults.map((result, i) => (
              <CommandItem
                key={`${result.date}-${i}`}
                onSelect={() => {
                  onNavigate("daily")
                  onOpenChange(false)
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="truncate">{result.content}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(result.date), "MMM d, yyyy")} · {result.type}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

      </CommandList>
    </CommandDialog>
  )
}
