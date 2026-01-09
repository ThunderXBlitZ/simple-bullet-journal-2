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
  CommandSeparator,
} from "@/components/ui/command"
import { CalendarDays, CalendarRange, CheckSquare, List, Search, Moon, Sun, Maximize2, Minimize2 } from "lucide-react"
import { useTheme } from "next-themes"
import { useJournalStore } from "@/lib/journal-store"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: string) => void
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const { theme, setTheme } = useTheme()
  const { dailyLogs, habits, collections, settings, toggleSetting } = useJournalStore()
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

      if (log.gratitude?.toLowerCase().includes(query)) {
        results.push({
          date,
          content: log.gratitude,
          type: "gratitude",
        })
      }
    })

    return results.slice(0, 10)
  }, [search, dailyLogs])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search entries, navigate, or run commands..."
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

        <CommandGroup heading="Navigate">
          <CommandItem
            onSelect={() => {
              onNavigate("daily")
              onOpenChange(false)
            }}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Daily Log
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNavigate("weekly")
              onOpenChange(false)
            }}
          >
            <CalendarRange className="mr-2 h-4 w-4" />
            Weekly View
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNavigate("monthly")
              onOpenChange(false)
            }}
          >
            <CalendarDays className="mr-2 h-4 w-4" />
            Monthly View
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNavigate("habits")
              onOpenChange(false)
            }}
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            Habit Tracker
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onNavigate("collections")
              onOpenChange(false)
            }}
          >
            <List className="mr-2 h-4 w-4" />
            Collections
          </CommandItem>
        </CommandGroup>

        {collections.length > 0 && (
          <CommandGroup heading="Collections">
            {collections.map((collection) => (
              <CommandItem
                key={collection.id}
                onSelect={() => {
                  onNavigate("collections")
                  onOpenChange(false)
                }}
              >
                <span className="mr-2">{collection.icon}</span>
                {collection.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              setTheme(theme === "dark" ? "light" : "dark")
              onOpenChange(false)
            }}
          >
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Toggle {theme === "dark" ? "Light" : "Dark"} Mode
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleSetting("focusMode")
              onOpenChange(false)
            }}
          >
            {settings.focusMode ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
            Toggle Focus Mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
