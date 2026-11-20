"use client"

import type { CSSProperties, ReactNode } from "react"
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVerticalIcon } from "@/components/icons/grip-vertical"
import { cn } from "@/lib/utils"

interface SortableListProps {
  ids: string[]
  onReorder: (fromIndex: number, toIndex: number) => void
  grid?: boolean
  children: ReactNode
}

export function SortableList({ ids, onReorder, grid, children }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from !== -1 && to !== -1) onReorder(from, to)
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

interface SortableItemProps {
  id: string
  className?: string
  handleClassName?: string
  children: ReactNode
  onClick?: () => void
}

/** Sortable row/card with a grip handle (only the handle starts a drag, so touch scroll still works). */
export function SortableItem({ id, className, handleClassName, children, onClick }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }
  return (
    <div ref={setNodeRef} style={style} onClick={onClick} className={cn(className, isDragging && "opacity-70 shadow-md")}>
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: "none" }}
        className={cn("cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground flex-shrink-0", handleClassName)}
      >
        <GripVerticalIcon size={16} />
      </button>
      {children}
    </div>
  )
}
