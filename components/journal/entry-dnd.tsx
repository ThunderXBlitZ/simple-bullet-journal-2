"use client"

import { type ReactNode } from "react"
import { type DragEndEvent, useSensor, useSensors, PointerSensor, TouchSensor, useDraggable, useDroppable } from "@dnd-kit/core"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { BulletEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { BulletIcon } from "./bullet-icon"
import { EntryItem, type EntryItemProps } from "./entry-item"

export function useEntrySensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
}

type ItemProps = Omit<EntryItemProps, "dragHandle" | "dragging">

/** Entry that reorders within its day (wrap in SortableContext). */
export function SortableEntry(props: ItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.entry.id,
  })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <EntryItem
        {...props}
        dragging={isDragging}
        dragHandle={{ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } }}
      />
    </div>
  )
}

export interface EntryDragData {
  entryId: string
  date: string
  entry: BulletEntry
}

/** Entry that can be dropped onto another date's DroppableDay. */
export function DraggableEntry(props: ItemProps) {
  const data: EntryDragData = { entryId: props.entry.id, date: props.date, entry: props.entry }
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `${props.date}:${props.entry.id}`,
    data,
  })
  return (
    <div ref={setNodeRef}>
      <EntryItem
        {...props}
        dragging={isDragging}
        dragHandle={{ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } }}
      />
    </div>
  )
}

export function DroppableDay({
  date,
  className,
  overClassName = "ring-2 ring-primary/60",
  children,
  onClick,
}: {
  date: string
  className?: string
  overClassName?: string
  children: ReactNode
  onClick?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}`, data: { date } })
  return (
    <div ref={setNodeRef} onClick={onClick} className={cn(className, isOver && overClassName)}>
      {children}
    </div>
  )
}

/** Resolves a drop of a DraggableEntry onto a DroppableDay into (from, to, id). */
export function resolveEntryDrop(e: DragEndEvent): { from: string; to: string; id: string } | null {
  const src = e.active.data.current as EntryDragData | undefined
  const to = e.over?.data.current?.date as string | undefined
  if (!src || !to || to === src.date) return null
  return { from: src.date, to, id: src.entryId }
}

export function EntryDragChip({ entry }: { entry: BulletEntry | null }) {
  if (!entry) return null
  return (
    <div className="flex items-center gap-2 rounded border border-primary/60 bg-background px-2 py-1 shadow-md max-w-[240px]">
      <BulletIcon type={entry.type} status={entry.status} />
      <span className="truncate font-serif text-sm">{entry.title || entry.content}</span>
    </div>
  )
}
