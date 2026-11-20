"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useJournalStore } from "@/lib/journal-store"
import { getRandomQuote } from "@/lib/quotes"
import { randomPlaceholder } from "@/lib/placeholders"
import { CollectionDetail } from "./collection-detail"
import { SortableItem, SortableList } from "./sortable"
import { cn } from "@/lib/utils"

const templateOptions = [
  { name: "Books to Read", icon: "📚" },
  { name: "Movies to Watch", icon: "🎬" },
  { name: "Goals", icon: "🎯" },
  { name: "Gratitude Log", icon: "💜" },
  { name: "Ideas", icon: "💡" },
  { name: "Bucket List", icon: "✨" },
]

const defaultIcons = ["📚", "🎬", "🎯", "💜", "💡", "✨", "🎵", "🏃", "✍️", "🌱"]

export function CollectionsView({ initialCollectionId = null }: { initialCollectionId?: string | null }) {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState(defaultIcons[0])
  const [selectedCollection, setSelectedCollection] = useState<string | null>(initialCollectionId)
  const [placeholder, setPlaceholder] = useState(randomPlaceholder)
  const [quote, setQuote] = useState(() => getRandomQuote())

  const {
    collections,
    addCollection,
    deleteCollection,
    reorderCollections,
  } = useJournalStore()

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
        <Input
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
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAddCollection()}>
                <Plus className="w-3 h-3 mr-1" />
                Create
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setNewName("")
                setIsAdding(false)
              }}>
                Cancel
              </Button>
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
                    {template.icon} {template.name}
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
        ) : selectedCollection && collections.some((c) => c.id === selectedCollection) ? (
          <CollectionDetail
            collectionId={selectedCollection}
            onBack={() => {
              setSelectedCollection(null)
              setQuote(getRandomQuote())
            }}
          />
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
                  onClick={() => {
                    setSelectedCollection(collection.id)
                    setQuote(getRandomQuote())
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{collection.icon}</span>
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
