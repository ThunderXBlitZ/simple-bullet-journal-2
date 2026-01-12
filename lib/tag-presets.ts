import type { Tag } from "./types"

export const tagPresets: Omit<Tag, "id" | "createdAt">[] = [
  { name: "Gratitude", color: "#ec4899" }, // Pink
  { name: "Idea", color: "#f97316" }, // Orange
  { name: "Important", color: "#ef4444" }, // Red
  { name: "Learning", color: "#3b82f6" }, // Blue
  { name: "Personal", color: "#8b5cf6" }, // Purple
  { name: "Work", color: "#06b6d4" }, // Cyan
  { name: "Health", color: "#22c55e" }, // Green
  { name: "Goals", color: "#eab308" }, // Yellow
  { name: "Travel", color: "#6366f1" }, // Indigo
  { name: "Family", color: "#f43f5e" }, // Rose
]

export const getPresetByName = (name: string) => {
  return tagPresets.find((p) => p.name === name)
}

export const getColorFromName = (name: string): string => {
  const preset = getPresetByName(name)
  return preset?.color || "#6b7280" // Default gray
}
