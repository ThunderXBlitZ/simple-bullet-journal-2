# M4 — UI Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Checkbox steps. **Never commit** (user does). Don't run test suites; run only listed verify commands. Visual checks are the user's.

**Goal:** Muted paper palette, colored **outlines** instead of filled blocks, and lucide-animated icons replacing every emoji — without any data migration.

**Architecture:** Color lives only in borders/rings/strokes; text stays `text-foreground`. A single `ink()` helper mutes any stored color (legacy hex or new `var(--ink-*)`) at render time, so stored tag/habit colors never need rewriting. Icons resolve through one registry that maps stored names *or legacy emoji* to a component (animated if installed, else lucide-react).

**Tech Stack:** Tailwind 4 tokens (oklch), `lucide-animated` via shadcn registry (`motion`), lucide-react.

**Spec:** `docs/milestones/00-design-decisions.md` (D8, palette default)

## Global Constraints
- No filled color blocks for tags, habits, completion, events (primary text/surface fills like `bg-background`, `bg-card`, `bg-accent` are fine).
- Colored **text** is avoided (contrast); color goes on borders/rings/icon strokes.
- Stored `Tag.color`/`Habit.color`/`icon` values stay valid: legacy hex and emoji must still render.
- Light = cream paper, dark kept. Serif font (Crimson Pro) unchanged.
- Mood/gratitude do not exist anymore: delete the dead components and tokens (no re-add).

## Review Focus
- Legacy emoji not in the map (e.g. user-picked 🌱 variants, multi-codepoint) → falls back to a Star icon, never blank/crash.
- Legacy bright hex tag colors (`#ec4899`…) must look muted after `ink()`, in both themes.
- Outline-only completed habit cell must still be *obviously* complete vs. incomplete (check icon + solid vs dashed border), including color-blind: shape differs, not only hue.
- Hover-animated icons inside buttons/touch: must not require hover to be understood; no layout shift on animation.
- Primary button outline style stays legible on both themes and when disabled.

---

### Task 1: Tokens and palette

**Files:** Modify `app/globals.css`, `lib/tag-presets.ts`; Create `lib/ink.ts`; Delete `components/journal/mood-selector.tsx`, `components/journal/mood-dropdown.tsx`

- [ ] **Step 1:** In `app/globals.css` `:root` block, delete the five `--mood-*` lines and replace the `--bullet-event`, `--bullet-complete`, `--habit-complete`, `--habit-incomplete` lines with:
```css
  --bullet-event: var(--ink-clay);
  --bullet-complete: var(--ink-sage);
  --habit-complete: var(--ink-sage);
  --habit-incomplete: oklch(0.88 0.01 80);
  --ink-sage: oklch(0.58 0.05 150);
  --ink-clay: oklch(0.58 0.07 45);
  --ink-blue: oklch(0.55 0.05 235);
  --ink-ochre: oklch(0.66 0.07 85);
  --ink-plum: oklch(0.52 0.05 330);
  --ink-rose: oklch(0.58 0.06 15);
  --ink-slate: oklch(0.5 0.02 250);
```
In the dark block (`.dark`): delete `--mood-*`, set the same variable names lighter:
```css
  --bullet-event: var(--ink-clay);
  --bullet-complete: var(--ink-sage);
  --habit-complete: var(--ink-sage);
  --habit-incomplete: oklch(0.3 0.01 260);
  --ink-sage: oklch(0.72 0.05 150);
  --ink-clay: oklch(0.72 0.06 45);
  --ink-blue: oklch(0.7 0.05 235);
  --ink-ochre: oklch(0.76 0.06 85);
  --ink-plum: oklch(0.68 0.05 330);
  --ink-rose: oklch(0.72 0.05 15);
  --ink-slate: oklch(0.68 0.02 250);
```
- [ ] **Step 2:** In `@theme inline`, delete any `--color-mood-*` lines and add (so `border-ink-sage` etc. exist): `--color-ink-sage: var(--ink-sage);` … one line each for clay, blue, ochre, plum, rose, slate.
- [ ] **Step 3:** `lib/ink.ts`:
```ts
export const INK_COLORS = [
  { id: "sage", label: "Sage", value: "var(--ink-sage)" },
  { id: "clay", label: "Clay", value: "var(--ink-clay)" },
  { id: "blue", label: "Blue", value: "var(--ink-blue)" },
  { id: "ochre", label: "Ochre", value: "var(--ink-ochre)" },
  { id: "plum", label: "Plum", value: "var(--ink-plum)" },
  { id: "rose", label: "Rose", value: "var(--ink-rose)" },
  { id: "slate", label: "Slate", value: "var(--ink-slate)" },
] as const

/** Mute any stored color for outline use. Theme vars pass through; legacy hex is blended toward the paper-gray. */
export const ink = (color: string): string =>
  color.startsWith("var(") ? color : `color-mix(in oklch, ${color} 55%, var(--muted-foreground))`
```
- [ ] **Step 4:** `lib/tag-presets.ts`: replace the hex colors with ink vars — Gratitude→`var(--ink-rose)`, Idea→`var(--ink-ochre)`, Important→`var(--ink-clay)`, Learning→`var(--ink-blue)`, Personal→`var(--ink-plum)`, Work→`var(--ink-slate)`, Health→`var(--ink-sage)`, Goals→`var(--ink-ochre)`, Travel→`var(--ink-blue)`, Family→`var(--ink-rose)`; change `getColorFromName` default to `"var(--ink-slate)"`.
- [ ] **Step 5:** `rm components/journal/mood-selector.tsx components/journal/mood-dropdown.tsx`; `grep -rn "mood" app components lib` → no hits.
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean.

### Task 2: Outline primitives

**Files:** Create `components/ui/outline-chip.tsx`; Modify `components/ui/button.tsx`

- [ ] **Step 1:** `components/ui/outline-chip.tsx`:
```tsx
import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { ink } from "@/lib/ink"

interface InkProps extends HTMLAttributes<HTMLSpanElement> {
  color: string
}

/** Pill with a colored outline; text stays foreground for contrast. */
export function OutlineChip({ color, className, style, children, ...props }: InkProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border bg-transparent px-2 py-0.5 text-xs text-foreground", className)}
      style={{ borderColor: ink(color), ...style }}
      {...props}
    >
      {children}
    </span>
  )
}

/** Small hollow dot. */
export function Ring({ color, className, style, ...props }: InkProps) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full border-[1.5px] bg-transparent", className)}
      style={{ borderColor: ink(color), ...style }}
      {...props}
    />
  )
}
```
- [ ] **Step 2:** `components/ui/button.tsx`: change the `default` variant classes to `"border border-primary bg-transparent text-primary hover:bg-primary/5"` and `destructive` to `"border border-destructive bg-transparent text-destructive hover:bg-destructive/5"`. Leave `outline`, `ghost`, `link` as they are.
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean.

### Task 3: Convert filled blocks to outlines

**Files:** Modify `components/journal/habit-tracker.tsx`, `tag-selector.tsx`, `entry-item.tsx`, `app/page.tsx`

Locate every target with: `grep -rnE "backgroundColor|bg-(primary|destructive|habit-|bullet-|yellow|green|red|blue)" components app --include='*.tsx' | grep -v "components/ui/"`

- [ ] **Step 1 — tag chips** (`entry-item.tsx` ~l.234, `tag-selector.tsx` ~l.69/109/139): replace `style={{ backgroundColor: tag.color }}` chips/dots with `<OutlineChip color={tag.color}>{tag.name}</OutlineChip>` (chips) or `<Ring color={tag.color} />` (dots). Selected tag in the picker = `border-2` via `className`, not a fill.
- [ ] **Step 2 — tag color picker** (`tag-selector.tsx`): the preset swatches come from `INK_COLORS` (`import { INK_COLORS } from "@/lib/ink"`), each swatch `<Ring color={c.value} className="size-4" />` with the selected one `border-2`; new tags store `c.value` (the `var(--ink-*)` string). Remove any free-form hex input.
- [ ] **Step 3 — habit grid** (`habit-tracker.tsx` ~l.249–252): completed cell = `border-2` in `ink(habit.color)` + a `Check` icon (same ink color via `style={{ color: ink(habit.color) }}`), **no background**; incomplete = `border border-dashed border-border`. Habit color picker (~l.164): swatches from `INK_COLORS` as `Ring`s; new habits store `c.value`.
- [ ] **Step 4 — focus-mode exit button** (`app/page.tsx`): `bg-primary text-primary-foreground … shadow-lg` → `border border-primary bg-background text-primary hover:bg-accent` (no shadow).
- [ ] **Step 5 — bullet complete** (`bullet-icon.tsx`): the "complete" bullet keeps its glyph shape; color via `text-bullet-complete` stroke only (check there is no `fill="currentColor"` on completion — if there is, change to `fill="none"` and add a check mark path so completion stays shape-distinct).
- [ ] **Verify:** the grep from the top of this task returns **only** `components/journal/monthly-view.tsx` lines (M5 rewrites that file). `npx tsc --noEmit | tail -n 20` clean.

### Task 4: Animated icons

**Files:** Create `components/icons/*` (generated), `components/journal/journal-icon.tsx`, `lib/icon-names.ts`; Modify views that render icons

- [ ] **Step 1 — install** (needs M2 `components.json`). Run:
```bash
for n in book-open dumbbell flower-2 droplets footprints pen-line target moon heart lightbulb sparkles music sprout star flame clapperboard \
         calendar-days calendar-range check search sun settings trash-2 plus x refresh-cw chevron-left chevron-right; do
  npx shadcn@latest add "https://lucide-animated.com/r/$n.json" --yes >/dev/null 2>&1 && echo "OK $n" || echo "MISSING $n"
done
```
Record the OK/MISSING list in `## Outcome`. Open one generated file (`sed -n 1,40p components/icons/<n>.tsx`) and note its export name and props (`size`/`className`).
- [ ] **Step 2 — `lib/icon-names.ts`** (the only file allowed to contain emoji):
```ts
/** Legacy emoji → icon id. Stored habit/collection icons from before M4 are emoji strings. */
export const EMOJI_TO_ICON: Record<string, string> = {
  "📚": "book-open", "💪": "dumbbell", "🧘": "flower-2", "💧": "droplets", "🏃": "footprints",
  "✍": "pen-line", "🎯": "target", "💤": "moon", "🎬": "clapperboard", "💜": "heart",
  "💡": "lightbulb", "✨": "sparkles", "🎵": "music", "🌱": "sprout",
}
export const FALLBACK_ICON = "star"
```
- [ ] **Step 3 — registry + component** `components/journal/journal-icon.tsx`. Build the registry from the Step 1 results: for each id, import the **animated** component when `OK`, else the lucide-react one (alias to avoid name clashes):
```tsx
"use client"

import type { ComponentType } from "react"
import { BookOpen, Dumbbell, Flower2, Droplets, Footprints, PenLine, Target, Moon, Clapperboard, Heart, Lightbulb, Sparkles, Music, Sprout, Star } from "lucide-react"
// Example of an animated import when Step 1 printed "OK book-open" (use the export name you recorded):
// import { BookOpen as BookOpenAnimated } from "@/components/icons/book-open"
import { EMOJI_TO_ICON, FALLBACK_ICON } from "@/lib/icon-names"

type IconComponent = ComponentType<{ className?: string; size?: number }>

/** id → component. Swap an entry to the *Animated import for every id that installed OK. */
const ICONS: Record<string, IconComponent> = {
  "book-open": BookOpen, dumbbell: Dumbbell, "flower-2": Flower2, droplets: Droplets, footprints: Footprints,
  "pen-line": PenLine, target: Target, moon: Moon, clapperboard: Clapperboard, heart: Heart,
  lightbulb: Lightbulb, sparkles: Sparkles, music: Music, sprout: Sprout, star: Star,
}

export const ICON_CHOICES = Object.keys(ICONS)

/** Accepts a stored icon id OR a legacy emoji; unknown values render the fallback. */
export function resolveIconName(stored: string): string {
  if (ICONS[stored]) return stored
  return EMOJI_TO_ICON[stored.replace(/️/g, "")] ?? FALLBACK_ICON
}

export function JournalIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[resolveIconName(name)]
  return <Icon className={className ?? "size-5"} />
}
```
Apply the `*Animated` swap for each `OK` id as described in the comment.
- [ ] **Step 4 — pickers and displays:** `habit-tracker.tsx`: `defaultIcons` emoji array → `ICON_CHOICES.slice(0, 8)`; every place that renders `habit.icon` → `<JournalIcon name={habit.icon} />`; the flame emoji streak → `<Flame className="size-4" />` (already imported from lucide-react; swap to the animated one if installed). `collections-view.tsx`: the six template entries keep their names but `icon` becomes an id (`book-open`, `clapperboard`, `target`, `heart`, `lightbulb`, `sparkles`); `defaultIcons` → `ICON_CHOICES`; render via `<JournalIcon>`. New items store the **id**.
- [ ] **Step 5 — UI icons:** in `sidebar.tsx`, `mobile-nav.tsx`, `command-palette.tsx`, `daily-log.tsx`, `weekly-view.tsx`, `entry-item.tsx`, `settings-modal.tsx`, `collections-view.tsx`: for each lucide-react icon whose animated twin installed `OK`, change the import to the animated component (same JSX usage). Missing twins stay as lucide-react. Do not touch `components/ui/*`.
- [ ] **Verify:** `grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' app components lib --include='*.ts' --include='*.tsx'` → hits only in `lib/icon-names.ts`. `npx tsc --noEmit | tail -n 20` clean; `npm run build 2>&1 | tail -n 10` succeeds (bundle size check: note `.next` first-load JS delta in Outcome).

### Task 5: Visual verification (user, light + dark)

- [ ] Open each view (Daily, Weekly, Monthly, Habits, Collections, Settings, Command palette, setup dialog):
  - No saturated fills; tags/habits/events show outlines; nothing looks neon.
  - Legacy data: existing habits/collections show icons (emoji mapped); a habit with an unmapped emoji shows a star.
  - Habit grid: completed cell has check + solid colored border; incomplete dashed gray — distinguishable at a glance.
  - Hover an animated icon → it animates, no layout jump; on mobile width (DevTools 390px) icons are static-readable.
  - Buttons: primary/destructive outlined, readable in both themes, disabled state visibly dimmed.
- [ ] Contrast spot-check: DevTools → inspect a tag chip: text is `foreground` on `background`.

## Outcome
_(filled at completion: icon OK/MISSING list, bundle delta, deviations)_
