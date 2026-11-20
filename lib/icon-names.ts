/** Legacy emoji → icon id. Habit/collection icons stored before M4 are emoji strings. Only file allowed to contain emoji. */
export const EMOJI_TO_ICON: Record<string, string> = {
  "📚": "book-text", "💪": "heart-pulse", "🧘": "leaf", "💧": "droplet", "🏃": "activity",
  "✍": "pen-tool", "🎯": "target", "💤": "moon", "🎬": "clap", "💜": "heart",
  "💡": "lightbulb", "✨": "sparkles", "🎵": "music", "🌱": "sprout",
}
export const FALLBACK_ICON = "star"
