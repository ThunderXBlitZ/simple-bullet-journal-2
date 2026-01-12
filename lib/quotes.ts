export const quotes = [
  "Your page awaits",
  "Start small, dream big",
  "Progress over perfection",
  "Build your future one day at a time",
  "One entry at a time",
  "Create one to organize your world",
  "Write it down, make it real",
  "Every word counts",
  "Your story matters",
  "Today is a blank page",
  "Keep going, you've got this",
  "Small steps, big changes",
  "Be here, be present",
  "Write your own story",
  "Magic happens in the details",
  "You are enough",
]

export function getRandomQuote(): string {
  return quotes[Math.floor(Math.random() * quotes.length)]
}
