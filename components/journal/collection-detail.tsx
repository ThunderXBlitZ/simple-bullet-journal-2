"use client"

import { useRef, useState } from "react"
import { Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useJournalStore } from "@/lib/journal-store"
import { useShallow } from "zustand/react/shallow"
import { getRandomQuote } from "@/lib/quotes"
import { cn } from "@/lib/utils"
import { SortableItem, SortableList } from "./sortable"
import { JournalIcon } from "@/components/journal/journal-icon"

export function CollectionDetail({ collectionId, onBack }: { collectionId: string; onBack: () => void }) {
  const [newItemContent, setNewItemContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const cancelled = useRef(false)
  const [quote] = useState(() => getRandomQuote())
  const { collections, addCollectionItem, toggleCollectionItem, updateCollectionItem, deleteCollectionItem, reorderCollectionItems } = useJournalStore(useShallow((s) => ({ collections: s.collections, addCollectionItem: s.addCollectionItem, toggleCollectionItem: s.toggleCollectionItem, updateCollectionItem: s.updateCollectionItem, deleteCollectionItem: s.deleteCollectionItem, reorderCollectionItems: s.reorderCollectionItems })))
  const collection = collections.find((c) => c.id === collectionId)
  if (!collection) return null

  const handleAddItem = () => {
    if (newItemContent.trim()) {
      addCollectionItem(collection.id, newItemContent.trim())
      setNewItemContent("")
    }
  }

  const saveEdit = (itemId: string) => {
    if (!cancelled.current && editContent.trim()) updateCollectionItem(collection.id, itemId, editContent.trim())
    setEditingId(null)
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        ← Back to collections
      </Button>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-xl flex items-center gap-2">
          <JournalIcon name={collection.icon} size={20} />
          {collection.name}
        </h3>
        <span className="text-sm text-muted-foreground">
          {collection.items.filter((i) => i.completed).length}/{collection.items.length} complete
        </span>
      </div>

      <div className="space-y-1 mb-4">
        {collection.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="text-5xl mb-3 font-mono">o_o</div>
            <p className="text-sm font-serif">{quote}</p>
            <p className="text-xs text-muted-foreground/60">Add an item to get started</p>
          </div>
        ) : (
          <SortableList ids={collection.items.map((i) => i.id)} onReorder={(from, to) => reorderCollectionItems(collection.id, from, to)}>
            {collection.items.map((item) => (
              <SortableItem key={item.id} id={item.id} className="flex items-center gap-2 py-2 px-2 rounded bg-background hover:bg-accent/30 group">
                <button
                  onClick={() => toggleCollectionItem(collection.id, item.id)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                    item.completed ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary",
                  )}
                >
                  {item.completed && (
                    <svg viewBox="0 0 16 16" className="w-3 h-3 text-primary-foreground">
                      <path d="M3 8l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {editingId === item.id ? (
                  <Input
                    autoComplete="off"
                    name="item-edit-text"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onBlur={() => saveEdit(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(item.id)
                      if (e.key === "Escape") {
                        cancelled.current = true
                        setEditingId(null)
                      }
                    }}
                    className="flex-1 font-serif h-8"
                    autoFocus
                  />
                ) : (
                  <span className={cn("flex-1 font-serif", item.completed && "line-through opacity-60")}>{item.content}</span>
                )}
                <button
                  onClick={() => {
                    cancelled.current = false
                    setEditingId(item.id)
                    setEditContent(item.content)
                  }}
                  aria-label="Edit item"
                  className="opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteCollectionItem(collection.id, item.id)}
                  className="opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </SortableItem>
            ))}
          </SortableList>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          autoComplete="off"
          name="item-new-text"
          value={newItemContent}
          onChange={(e) => setNewItemContent(e.target.value)}
          placeholder="Add an item..."
          className="font-serif"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddItem()
          }}
        />
        <Button onClick={handleAddItem}>Add</Button>
      </div>
    </div>
  )
}
