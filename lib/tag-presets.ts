import type { Tag } from "./types"

export const tagPresets: Omit<Tag, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Gratitude", color: "#c4838f" }, // Dusty rose
  { name: "Idea", color: "#cf9a6b" }, // Clay
  { name: "Important", color: "#b86b66" }, // Brick
  { name: "Learning", color: "#6f8fb0" }, // Dusty blue
  { name: "Personal", color: "#8f7fae" }, // Lavender
  { name: "Work", color: "#6fa3a3" }, // Sage teal
  { name: "Health", color: "#7fa585" }, // Sage green
  { name: "Goals", color: "#c2a867" }, // Ochre
  { name: "Travel", color: "#7a85b3" }, // Slate indigo
  { name: "Family", color: "#bd7b8c" }, // Mauve
]

/** Pre-muted preset hexes → current palette, so tags already stored on devices/Drive render muted without a data migration. */
const LEGACY_COLORS: Record<string, string> = {
  "#ec4899": "#c4838f", "#f97316": "#cf9a6b", "#ef4444": "#b86b66", "#3b82f6": "#6f8fb0", "#8b5cf6": "#8f7fae",
  "#06b6d4": "#6fa3a3", "#22c55e": "#7fa585", "#eab308": "#c2a867", "#6366f1": "#7a85b3", "#f43f5e": "#bd7b8c",
}
export const tagColor = (c: string): string => LEGACY_COLORS[c.toLowerCase()] ?? c

export const getPresetByName = (name: string) => {
  return tagPresets.find((p) => p.name === name)
}

export const getColorFromName = (name: string): string => {
  const preset = getPresetByName(name)
  return preset?.color || "#6b7280" // Default gray
}
