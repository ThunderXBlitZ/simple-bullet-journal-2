"use client"

import { useState } from "react"
import { navigate, routes } from "@/lib/routes"
import { Trash2 } from "lucide-react"
import { CheckIcon } from "@/components/icons/check"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { getRandomQuote } from "@/lib/quotes"
import { randomPlaceholder } from "@/lib/placeholders"
import { SortableItem, SortableList } from "./sortable"
import { cn } from "@/lib/utils"
import { JournalIcon, ICON_CHOICES } from "@/components/journal/journal-icon"

const templateOptions = [
  { name: "Books to Read", icon: "book-text" },
  { name: "Movies to Watch", icon: "clap" },
  { name: "Goals", icon: "target" },
  { name: "Gratitude Log", icon: "heart" },
  { name: "Ideas", icon: "lightbulb" },
  { name: "Bucket List", icon: "sparkles" },
]

const defaultIcons = ICON_CHOICES

export function CollectionsView() {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState(defaultIcons[0])
  const [placeholder, setPlaceholder] = useState(randomPlaceholder)
  const [quote] = useState(() => getRandomQuote())

  const { collections, addCollection, deleteCollection, reorderCollections } = useJournalStore(useShallow((s) => ({ collections: s.collections, addCollection: s.addCollection, deleteCollection: s.deleteCollection, reorderCollections: s.reorderCollections })))

  const handleAddCollection = (name?: string, icon?: string) => {
    const finalName = name || newName.trim()
    const finalIcon = icon || selectedIcon
    if (finalName) {
      addCollection(finalName, finalIcon)
      setNewName("")
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <h2 className="font-serif text-lg">Collections</h2>
      </div>

      {/* Add Collection Input */}
      <div className="px-0 py-2 border-b border-dashed border-border space-y-3">
        <div className="flex items-center gap-2">
        <Input
          autoComplete="off"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={placeholder}
          className="font-serif"
          autoFocus={isAdding}
          onFocus={() => {
            if (!isAdding) setPlaceholder(randomPlaceholder())
            setIsAdding(true)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddCollection()
            if (e.key === "Escape") {
              setNewName("")
              setIsAdding(false)
            }
          }}
        />
        {newName.trim() && (
          <Button size="icon" className="shrink-0" onClick={() => handleAddCollection()} aria-label="Create collection">
            <CheckIcon size={16} />
          </Button>
        )}
        </div>

        {newName.trim() && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Icon:</span>
              <div className="flex gap-1 flex-wrap">
                {defaultIcons.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={cn(
                      "w-8 h-8 rounded flex items-center justify-center transition-colors",
                      selectedIcon === icon ? "bg-accent" : "hover:bg-accent/50",
                    )}
                  >
                    <JournalIcon name={icon} />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-dashed border-border">
              <span className="text-sm text-muted-foreground mb-2 block">Quick templates:</span>
              <div className="flex flex-wrap gap-2">
                {templateOptions.map((template) => (
                  <Button
                    key={template.name}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddCollection(template.name, template.icon)}
                    className="text-xs"
                  >
                    <JournalIcon name={template.icon} size={14} className="mr-1" />{template.name}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Collections Grid / Detail View */}
      <div className="flex-1 overflow-y-auto py-4">
        {collections.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="text-6xl mb-4 font-mono">:)</div>
            <p className="text-lg font-serif">{quote}</p>
            <p className="text-xs text-muted-foreground/60">Create one to organize your world</p>
          </div>
        ) : (
          // Collections Grid
          <SortableList ids={collections.map((c) => c.id)} onReorder={reorderCollections} grid>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => {
              const completedCount = collection.items.filter((i) => i.completed).length
              const totalCount = collection.items.length
              const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

              return (
                <SortableItem
                  key={collection.id}
                  id={collection.id}
                  className="relative border border-border rounded-lg p-4 pt-6 bg-background hover:border-primary/50 transition-colors cursor-pointer group"
                  handleClassName="absolute top-1 left-1 p-0.5"
                  onClick={() => navigate(routes.collection(collection.id))}
                >
                  <div className="flex items-start justify-between mb-2">
                    <JournalIcon name={collection.icon} size={28} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCollection(collection.id)
                      }}
                      className="opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="font-serif font-medium mb-1">{collection.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {completedCount}/{totalCount} items
                  </p>

                  {totalCount > 0 && (
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                  )}
                </SortableItem>
              )
            })}
          </div>
          </SortableList>
        )}
      </div>
    </div>
  )
}
