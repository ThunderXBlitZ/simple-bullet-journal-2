const POOL = [
  "start writing here :)",
  "what's on your mind?",
  "jot something down…",
  "a small thought is welcome",
  "name it…",
  "what do you want to remember?",
  "write it down, let it go",
  "something worth keeping…",
]

export function randomPlaceholder(): string {
  return POOL[Math.floor(Math.random() * POOL.length)]
}
