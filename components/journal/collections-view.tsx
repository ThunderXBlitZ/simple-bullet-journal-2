"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useJournalStore } from "@/lib/journal-store"
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

export function CollectionsView() {
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState(defaultIcons[0])
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [newItemContent, setNewItemContent] = useState("")

  const {
    collections,
    addCollection,
    deleteCollection,
    addCollectionItem,
    toggleCollectionItem,
    deleteCollectionItem,
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

  const handleAddItem = (collectionId: string) => {
    if (newItemContent.trim()) {
      addCollectionItem(collectionId, newItemContent.trim())
      setNewItemContent("")
    }
  }

  const activeCollection = collections.find((c) => c.id === selectedCollection)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <h2 className="font-serif text-lg">Collections</h2>
        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New Collection
        </Button>
      </div>

      {/* Add Collection Form */}
      {isAdding && (
        <div className="py-4 border-b border-border space-y-3">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name..."
              className="font-serif"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCollection()
                if (e.key === "Escape") setIsAdding(false)
              }}
            />
          </div>

          <div className="flex items-center gap-2">
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
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
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
        </div>
      )}

      {/* Collections Grid / Detail View */}
      <div className="flex-1 overflow-y-auto py-4">
        {collections.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ListIcon className="w-12 h-12 mb-2 opacity-50" />
            <p className="font-serif">No collections yet</p>
            <p className="text-sm">Create a collection to organize your lists</p>
          </div>
        ) : selectedCollection && activeCollection ? (
          // Collection Detail View
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCollection(null)} className="mb-4">
              ← Back to collections
            </Button>

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl flex items-center gap-2">
                <span>{activeCollection.icon}</span>
                {activeCollection.name}
              </h3>
              <span className="text-sm text-muted-foreground">
                {activeCollection.items.filter((i) => i.completed).length}/{activeCollection.items.length} complete
              </span>
            </div>

            <div className="space-y-1 mb-4">
              {activeCollection.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-accent/30 group">
                  <button
                    onClick={() => toggleCollectionItem(activeCollection.id, item.id)}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      item.completed ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary",
                    )}
                  >
                    {item.completed && (
                      <svg viewBox="0 0 16 16" className="w-3 h-3 text-primary-foreground">
                        <path
                          d="M3 8l3 3 7-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  <span className={cn("flex-1 font-serif", item.completed && "line-through opacity-60")}>
                    {item.content}
                  </span>

                  <button
                    onClick={() => deleteCollectionItem(activeCollection.id, item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                placeholder="Add an item..."
                className="font-serif"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem(activeCollection.id)
                }}
              />
              <Button onClick={() => handleAddItem(activeCollection.id)}>Add</Button>
            </div>
          </div>
        ) : (
          // Collections Grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => {
              const completedCount = collection.items.filter((i) => i.completed).length
              const totalCount = collection.items.length
              const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

              return (
                <div
                  key={collection.id}
                  className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedCollection(collection.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{collection.icon}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCollection(collection.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" strokeLinecap="round" />
      <line x1="3" y1="12" x2="3.01" y2="12" strokeLinecap="round" />
      <line x1="3" y1="18" x2="3.01" y2="18" strokeLinecap="round" />
    </svg>
  )
}
