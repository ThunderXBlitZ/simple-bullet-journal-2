"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Repeat, Tag as TagIcon } from "lucide-react"
import { SearchIcon } from "@/components/icons/search"
import { FolderOpenIcon } from "@/components/icons/folder-open"
import { XIcon } from "@/components/icons/x"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { JournalIcon } from "@/components/journal/journal-icon"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (view: string, target?: { date?: string; collectionId?: string }) => void
}

const MAX = 8

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const { dailyLogs, habits, collections, tags } = useJournalStore(useShallow((s) => ({ dailyLogs: s.dailyLogs, habits: s.habits, collections: s.collections, tags: s.tags })))
  const [search, setSearch] = useState("")
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const go = (view: string, target?: { date?: string; collectionId?: string }) => {
    onNavigate(view, target)
    onOpenChange(false)
  }

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    const entriesFor = (match: (e: { content: string; title?: string; tagIds?: string[] }) => boolean) =>
      Object.entries(dailyLogs)
        .flatMap(([date, log]) => log.entries.filter(match).map((e) => ({ date, id: e.id, content: e.content, type: e.type })))
        .sort((a, b) => b.date.localeCompare(a.date))
    if (tagFilter) return { entries: entriesFor((e) => !!e.tagIds?.includes(tagFilter)).slice(0, 20), habits: [], collections: [], tags: [] }
    if (!q) return { entries: [], habits: [], collections: [], tags: [] }
    return {
      entries: entriesFor((e) => e.content.toLowerCase().includes(q) || !!e.title?.toLowerCase().includes(q)).slice(0, MAX),
      habits: habits.filter((h) => h.name.toLowerCase().includes(q)).slice(0, MAX),
      collections: collections
        .map((c) => ({ c, item: c.items.find((i) => i.content.toLowerCase().includes(q)) }))
        .filter(({ c, item }) => c.name.toLowerCase().includes(q) || item)
        .slice(0, MAX),
      tags: tags.filter((t) => t.name.toLowerCase().includes(q)).slice(0, MAX),
    }
  }, [search, tagFilter, dailyLogs, habits, collections, tags])

  // cmdk fuzzy-filters by item value; embedding the query keeps our own matches visible.
  const val = (id: string) => `${search} ${id}`
  const activeTag = tags.find((t) => t.id === tagFilter)
  const none = !results.entries.length && !results.habits.length && !results.collections.length && !results.tags.length

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTagFilter(null)
        onOpenChange(o)
      }}
    >
      <CommandInput placeholder="Search entries, habits, collections, tags..." value={search} onValueChange={setSearch} />
      <CommandList>
        {activeTag && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <TagIcon className="h-3 w-3" /> Entries tagged {activeTag.name}
            <button onClick={() => setTagFilter(null)} className="ml-auto hover:text-foreground" aria-label="Clear tag filter">
              <XIcon size={12} />
            </button>
          </div>
        )}
        {none && <CommandEmpty>No results found.</CommandEmpty>}

        {results.entries.length > 0 && (
          <CommandGroup heading="Entries">
            {results.entries.map((r) => (
              <CommandItem key={r.id} value={val(r.id)} onSelect={() => go("daily", { date: r.date })}>
                <SearchIcon size={16} className="mr-2" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{r.content}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(`${r.date}T00:00:00`), "MMM d, yyyy")} · {r.type}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.habits.length > 0 && (
          <CommandGroup heading="Habits">
            {results.habits.map((h) => (
              <CommandItem key={h.id} value={val(h.id)} onSelect={() => go("habits")}>
                <Repeat className="mr-2 h-4 w-4" />
                <span className="truncate"><JournalIcon name={h.icon} size={14} className="mr-1.5 align-text-bottom" />{h.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.collections.length > 0 && (
          <CommandGroup heading="Collections">
            {results.collections.map(({ c, item }) => (
              <CommandItem key={c.id} value={val(c.id)} onSelect={() => go("collections", { collectionId: c.id })}>
                <FolderOpenIcon size={16} className="mr-2" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate"><JournalIcon name={c.icon} size={14} className="mr-1.5 align-text-bottom" />{c.name}</span>
                  {item && !c.name.toLowerCase().includes(search.trim().toLowerCase()) && (
                    <span className="text-xs text-muted-foreground truncate">{item.content}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.tags.length > 0 && (
          <CommandGroup heading="Tags">
            {results.tags.map((t) => (
              <CommandItem
                key={t.id}
                value={val(t.id)}
                onSelect={() => {
                  setTagFilter(t.id)
                  setSearch("")
                }}
              >
                <TagIcon className="mr-2 h-4 w-4" />
                <span className="truncate">{t.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
