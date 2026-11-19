# M5 — Monthly Hints & Tag Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Checkbox steps. **Never commit** (user does). Don't run test suites; `scripts/verify-*.ts` are PASS/FAIL scripts the **user** runs.

**Goal:** Monthly calendar cells show entry count + tag rings with a hover preview, a month summary strip tabulates totals and tags, and a tag filter narrows Daily/Weekly/Monthly.

**Architecture:** All counting lives in pure `lib/month-stats.ts`. A small React context (`tag-filter.tsx`) holds the session-only filter; views read it and call `filterEntries`. The month cell and summary are separate components so `monthly-view.tsx` stays small.

**Tech Stack:** React 19, date-fns, shadcn hover-card (Radix), M4 `OutlineChip`/`Ring`.

**Spec:** `docs/milestones/00-design-decisions.md` (D9, D10)

## Global Constraints
- Outlines only (M4 rules): rings/chips use `ink()`; no filled color blocks.
- Dates are local (`format(date, "yyyy-MM-dd")`), never UTC.
- Filter semantics: **OR** — an entry matches if it has *any* selected tag; untagged entries are hidden while a filter is active. Filter is session-only (not persisted, not synced).
- Task counts use **actionable** tasks only (`open` + `complete`); `migrated`/`scheduled`/`irrelevant` are excluded from the done-percentage.
- Mobile (<640px): cell = date + count badge + rings only; hover preview is desktop-only.

## Review Focus
- Tag deleted while it is an active filter → filter must self-clear (not show an empty journal forever).
- Reordering entries while filtered would use indices of the *filtered* list → reordering must be disabled while a filter is active.
- Adding an entry while filtered: new untagged entry is hidden → the UI must say a filter is active (bar shows it) and an empty-match message appears rather than a blank day.
- Day with zero entries: no badge, no hover card, still clickable.
- Entries whose `tagIds` reference a tag that no longer exists → ignored in rings/tabulation, no crash.
- Months with 31 days + padding days: summary counts only days inside the displayed month.

---

### Task 1: Stats module + verify script

**Files:** Create `lib/month-stats.ts`, `scripts/verify-month-stats.ts`

- [ ] **Step 1:** `lib/month-stats.ts` (type-only imports so `tsx` runs it):
```ts
import type { BulletEntry, DailyLog, HabitCompletion } from "./types"

export interface TagCount { tagId: string; count: number }

export const filterEntries = (entries: BulletEntry[], activeTagIds: string[]): BulletEntry[] =>
  activeTagIds.length === 0 ? entries : entries.filter((e) => e.tagIds?.some((id) => activeTagIds.includes(id)))

export function tagCounts(entries: BulletEntry[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const e of entries) for (const id of e.tagIds ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts]
    .map(([tagId, count]) => ({ tagId, count }))
    .sort((a, b) => b.count - a.count || a.tagId.localeCompare(b.tagId))
}

const isActionable = (e: BulletEntry) => e.type === "task" && (e.status === "open" || e.status === "complete")

export interface DayStats { total: number; tasks: number; tasksDone: number; topTagIds: string[] }

export function dayStats(entries: BulletEntry[]): DayStats {
  const tasks = entries.filter(isActionable)
  return {
    total: entries.length,
    tasks: tasks.length,
    tasksDone: tasks.filter((e) => e.status === "complete").length,
    topTagIds: tagCounts(entries).slice(0, 3).map((t) => t.tagId),
  }
}

export interface MonthSummary {
  total: number
  tasks: number
  tasksDone: number
  activeDays: number
  habitCheckIns: number
  tagCounts: TagCount[]
}

/** `dateStrs` = the YYYY-MM-DD days of the displayed month only (no padding days). */
export function monthSummary(
  dateStrs: string[],
  logs: Record<string, DailyLog>,
  completions: HabitCompletion[],
  activeTagIds: string[],
): MonthSummary {
  const days = new Set(dateStrs)
  const entries: BulletEntry[] = []
  let activeDays = 0
  for (const d of dateStrs) {
    const visible = filterEntries(logs[d]?.entries ?? [], activeTagIds)
    if (visible.length) activeDays++
    entries.push(...visible)
  }
  const tasks = entries.filter(isActionable)
  return {
    total: entries.length,
    tasks: tasks.length,
    tasksDone: tasks.filter((e) => e.status === "complete").length,
    activeDays,
    habitCheckIns: completions.filter((c) => c.completed && days.has(c.date)).length,
    tagCounts: tagCounts(entries),
  }
}
```
- [ ] **Step 2:** `scripts/verify-month-stats.ts`:
```ts
import assert from "node:assert"
import { dayStats, filterEntries, monthSummary, tagCounts } from "../lib/month-stats"

const e = (id: string, type: "task" | "event" | "note", status: string, tagIds?: string[]) =>
  ({ id, type, status, content: id, indent: 0, order: 0, tagIds, createdAt: "", updatedAt: "" }) as any

const logs = {
  "2026-03-01": { date: "2026-03-01", entries: [e("a", "task", "complete", ["w"]), e("b", "task", "open", ["w", "h"]), e("c", "task", "irrelevant")] },
  "2026-03-02": { date: "2026-03-02", entries: [e("d", "note", "complete", ["h"])] },
}
const days = ["2026-03-01", "2026-03-02", "2026-03-03"]
const checks: [string, () => void][] = [
  ["day stats ignore irrelevant tasks", () => assert.deepEqual(dayStats(logs["2026-03-01"].entries), { total: 3, tasks: 2, tasksDone: 1, topTagIds: ["w", "h"] })],
  ["tag counts sorted desc", () => assert.deepEqual(tagCounts([...logs["2026-03-01"].entries, ...logs["2026-03-02"].entries]), [{ tagId: "h", count: 2 }, { tagId: "w", count: 2 }])],
  ["filter OR + hides untagged", () => assert.equal(filterEntries(logs["2026-03-01"].entries, ["h"]).length, 1)],
  ["month summary totals", () => {
    const s = monthSummary(days, logs as any, [{ habitId: "x", date: "2026-03-02", completed: true, updatedAt: "" }, { habitId: "x", date: "2026-04-01", completed: true, updatedAt: "" }], [])
    assert.deepEqual([s.total, s.tasks, s.tasksDone, s.activeDays, s.habitCheckIns], [4, 2, 1, 2, 1])
  }],
  ["month summary respects filter", () => assert.equal(monthSummary(days, logs as any, [], ["h"]).total, 2)],
  ["missing day is fine", () => assert.equal(dayStats([]).total, 0)],
]
let fail = 0
for (const [name, fn] of checks) {
  try { fn(); console.log(`PASS ${name}`) } catch (err) { fail++; console.log(`FAIL ${name}: ${(err as Error).message.split("\n")[0]}`) }
}
process.exit(fail ? 1 : 0)
```
- [ ] **Verify (user):** `npx tsx scripts/verify-month-stats.ts` → 6 PASS.

### Task 2: Tag filter state + bar

**Files:** Create `lib/tag-filter.tsx`, `components/journal/tag-filter-bar.tsx`; Modify `app/page.tsx`

- [ ] **Step 1:** `lib/tag-filter.tsx`:
```tsx
"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

interface TagFilter {
  activeTagIds: string[]
  toggleTag: (id: string) => void
  clear: () => void
}

const TagFilterContext = createContext<TagFilter | null>(null)

export function TagFilterProvider({ children }: { children: ReactNode }) {
  const [activeTagIds, setActive] = useState<string[]>([])
  const value = useMemo<TagFilter>(
    () => ({
      activeTagIds,
      toggleTag: (id) => setActive((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
      clear: () => setActive([]),
    }),
    [activeTagIds],
  )
  return <TagFilterContext.Provider value={value}>{children}</TagFilterContext.Provider>
}

export function useTagFilter(): TagFilter {
  const v = useContext(TagFilterContext)
  if (!v) throw new Error("useTagFilter must be used inside TagFilterProvider")
  return v
}
```
- [ ] **Step 2:** `components/journal/tag-filter-bar.tsx`:
```tsx
"use client"

import { useEffect, useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OutlineChip } from "@/components/ui/outline-chip"
import { useJournalStore } from "@/lib/journal-store"
import { useTagFilter } from "@/lib/tag-filter"
import { tagCounts } from "@/lib/month-stats"
import { cn } from "@/lib/utils"

export function TagFilterBar() {
  const { dailyLogs, tags } = useJournalStore()
  const { activeTagIds, toggleTag, clear } = useTagFilter()
  const counts = useMemo(() => tagCounts(Object.values(dailyLogs).flatMap((l) => l.entries)), [dailyLogs])

  // A deleted tag must not linger as an invisible filter.
  useEffect(() => {
    for (const id of activeTagIds) if (!tags.some((t) => t.id === id)) toggleTag(id)
  }, [tags, activeTagIds, toggleTag])

  const shown = counts.filter((c) => tags.some((t) => t.id === c.tagId))
  if (shown.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2" role="group" aria-label="Filter by tag">
      {shown.map(({ tagId, count }) => {
        const tag = tags.find((t) => t.id === tagId)!
        const on = activeTagIds.includes(tagId)
        return (
          <button key={tagId} type="button" aria-pressed={on} onClick={() => toggleTag(tagId)}>
            <OutlineChip color={tag.color} className={cn("cursor-pointer hover:bg-accent", on && "border-2 bg-accent")}>
              {tag.name}
              <span className="text-muted-foreground">{count}</span>
            </OutlineChip>
          </button>
        )
      })}
      {activeTagIds.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clear}>
          <X className="w-3 h-3 mr-1" />
          Clear filter
        </Button>
      )}
    </div>
  )
}
```
- [ ] **Step 3:** `app/page.tsx`: import `TagFilterProvider` and `TagFilterBar`; wrap the returned main layout root `<div className={cn("flex flex-col md:flex-row h-screen …")}>` contents in `<TagFilterProvider>…</TagFilterProvider>` (the provider goes just inside that root div, around everything); in `<main>`, above the scrolling div, render `{currentView !== "habits" && currentView !== "collections" && <TagFilterBar />}`.
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean.

### Task 3: Month cell, summary, view

**Files:** Run shadcn add; Create `components/journal/month-day-cell.tsx`, `components/journal/month-summary.tsx`; Replace `components/journal/monthly-view.tsx`

- [ ] **Step 1:** `npx shadcn@latest add hover-card --yes` → creates `components/ui/hover-card.tsx`.
- [ ] **Step 2:** `components/journal/month-day-cell.tsx`:
```tsx
"use client"

import { format, isToday } from "date-fns"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Ring } from "@/components/ui/outline-chip"
import { BulletIcon } from "./bullet-icon"
import { dayStats } from "@/lib/month-stats"
import type { BulletEntry, Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

interface MonthDayCellProps {
  day: Date
  inMonth: boolean
  entries: BulletEntry[]
  habitsDone: number
  tags: Tag[]
  onClick: () => void
}

export function MonthDayCell({ day, inMonth, entries, habitsDone, tags, onClick }: MonthDayCellProps) {
  const stats = dayStats(entries)
  const topTags = stats.topTagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t)
  const today = isToday(day)
  const label = `${format(day, "EEEE d MMMM")}: ${stats.total} ${stats.total === 1 ? "entry" : "entries"}`

  const cell = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "aspect-square w-full rounded-md border p-1 text-left flex flex-col transition-colors hover:bg-accent/30",
        today ? "border-2 border-primary" : "border-border/60",
        !inMonth && "opacity-30",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className={cn("text-sm font-serif", today && "font-semibold")}>{format(day, "d")}</span>
        {stats.total > 0 && (
          <span className="rounded-full border border-border px-1 text-[10px] leading-4 tabular-nums text-muted-foreground">
            {stats.total}
          </span>
        )}
      </div>
      <div className="mt-auto flex items-center gap-0.5">
        {topTags.map((t) => (
          <Ring key={t.id} color={t.color} title={t.name} />
        ))}
      </div>
    </button>
  )

  if (stats.total === 0) return cell

  return (
    <HoverCard openDelay={250} closeDelay={50}>
      <HoverCardTrigger asChild>{cell}</HoverCardTrigger>
      <HoverCardContent align="start" className="hidden w-64 space-y-1.5 text-sm sm:block">
        <div className="font-serif font-medium">{format(day, "EEEE d MMMM")}</div>
        {entries.slice(0, 5).map((e) => (
          <div key={e.id} className="flex items-start gap-2">
            <BulletIcon type={e.type} status={e.status} className="mt-1" />
            <span className="line-clamp-2">{e.title || e.content}</span>
          </div>
        ))}
        {entries.length > 5 && <div className="text-xs text-muted-foreground">+{entries.length - 5} more</div>}
        {habitsDone > 0 && <div className="text-xs text-muted-foreground">{habitsDone} habit{habitsDone === 1 ? "" : "s"} done</div>}
      </HoverCardContent>
    </HoverCard>
  )
}
```
- [ ] **Step 3:** `components/journal/month-summary.tsx`:
```tsx
"use client"

import { OutlineChip } from "@/components/ui/outline-chip"
import type { MonthSummary as Summary } from "@/lib/month-stats"
import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  summary: Summary
  tags: Tag[]
  activeTagIds: string[]
  onToggleTag: (id: string) => void
}

export function MonthSummary({ summary, tags, activeTagIds, onToggleTag }: Props) {
  if (summary.total === 0) {
    return <p className="py-2 text-sm text-muted-foreground">No entries this month{activeTagIds.length ? " match the filter" : ""}.</p>
  }
  const pct = summary.tasks ? Math.round((summary.tasksDone / summary.tasks) * 100) : null
  const facts = [
    `${summary.total} ${summary.total === 1 ? "entry" : "entries"}`,
    summary.tasks ? `${summary.tasksDone}/${summary.tasks} tasks done (${pct}%)` : null,
    `${summary.activeDays} active ${summary.activeDays === 1 ? "day" : "days"}`,
    summary.habitCheckIns ? `${summary.habitCheckIns} habit check-ins` : null,
  ].filter(Boolean)
  const tagRows = summary.tagCounts
    .map((c) => ({ ...c, tag: tags.find((t) => t.id === c.tagId) }))
    .filter((r): r is typeof r & { tag: Tag } => !!r.tag)
    .slice(0, 8)

  return (
    <div className="space-y-2 py-2">
      <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
      {tagRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagRows.map(({ tag, count }) => (
            <button key={tag.id} type="button" aria-pressed={activeTagIds.includes(tag.id)} onClick={() => onToggleTag(tag.id)}>
              <OutlineChip color={tag.color} className={cn("cursor-pointer hover:bg-accent", activeTagIds.includes(tag.id) && "border-2 bg-accent")}>
                {tag.name}
                <span className="text-muted-foreground">{count}</span>
              </OutlineChip>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```
- [ ] **Step 4:** Replace `components/journal/monthly-view.tsx` entirely:
```tsx
"use client"

import { useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MonthDayCell } from "./month-day-cell"
import { MonthSummary } from "./month-summary"
import { useJournalStore } from "@/lib/journal-store"
import { useTagFilter } from "@/lib/tag-filter"
import { filterEntries, monthSummary } from "@/lib/month-stats"
import { getRandomQuote } from "@/lib/quotes"

interface MonthlyViewProps {
  onDateClick?: (date: Date) => void
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function MonthlyView({ onDateClick }: MonthlyViewProps = {}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [quote, setQuote] = useState(() => getRandomQuote())
  const { dailyLogs, habitCompletions, tags, userName } = useJournalStore()
  const { activeTagIds, toggleTag } = useTagFilter()

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  })

  const summary = useMemo(() => {
    const monthDates = days.filter((d) => isSameMonth(d, currentMonth)).map((d) => format(d, "yyyy-MM-dd"))
    return monthSummary(monthDates, dailyLogs, habitCompletions, activeTagIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, dailyLogs, habitCompletions, activeTagIds])

  const go = (next: Date) => {
    setCurrentMonth(next)
    setQuote(getRandomQuote())
  }

  return (
    <div className="flex flex-col h-full">
      <div className="pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="md:hidden font-serif text-sm font-semibold text-foreground">{userName}'s Bullet Journal</div>
          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="flex-shrink-0" aria-label="Previous month" onClick={() => go(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={() => go(new Date())} className="font-serif text-base md:text-lg whitespace-nowrap">
              {format(currentMonth, "MMMM yyyy")}
            </Button>
            <Button variant="ghost" size="icon" className="flex-shrink-0" aria-label="Next month" onClick={() => go(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <MonthSummary summary={summary} tags={tags} activeTagIds={activeTagIds} onToggleTag={toggleTag} />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground font-serif py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd")
            return (
              <MonthDayCell
                key={dateStr}
                day={day}
                inMonth={isSameMonth(day, currentMonth)}
                entries={filterEntries(dailyLogs[dateStr]?.entries ?? [], activeTagIds)}
                habitsDone={habitCompletions.filter((c) => c.date === dateStr && c.completed).length}
                tags={tags}
                onClick={() => onDateClick?.(day)}
              />
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Number = entries that day</span>
          <span>Rings = most-used tags</span>
        </div>

        <div className="py-2 mt-4 border-t border-border text-center">
          <p className="text-sm font-serif text-muted-foreground italic">{quote}</p>
        </div>
      </div>
    </div>
  )
}
```
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean; the M4 gate grep (`grep -rnE "backgroundColor|bg-(primary|destructive|habit-|bullet-|yellow|green|red|blue)" components app --include='*.tsx' | grep -v components/ui/`) now returns **nothing**.

### Task 4: Apply filter in Daily and Weekly

**Files:** Modify `components/journal/daily-log.tsx`, `components/journal/weekly-view.tsx`, `components/journal/entry-item.tsx`

- [ ] **Step 1 — daily-log.tsx:** import `useTagFilter` and `filterEntries`; after `const dailyLog = getDailyLog(dateStr)` add:
```tsx
const { activeTagIds } = useTagFilter()
const visibleEntries = filterEntries(dailyLog.entries, activeTagIds)
const filtering = activeTagIds.length > 0
```
Render `visibleEntries` instead of `dailyLog.entries` in the list (~l.118/126). Empty state: when `dailyLog.entries.length === 0` keep the existing empty message; when `visibleEntries.length === 0 && filtering` show `<p className="text-sm text-muted-foreground">No entries match the selected tags.</p>`. Pass reorder only when unfiltered: `onReorder={filtering ? undefined : (from, to) => reorderEntries(dateStr, from, to)}`. Keep `incompleteTasks` (migration, ~l.62) on the **unfiltered** list.
- [ ] **Step 2 — entry-item.tsx:** `grep -n onReorder components/journal/entry-item.tsx`: make the prop optional (`onReorder?: …`) and do not render drag handles / do not attach drag handlers when it is undefined.
- [ ] **Step 3 — weekly-view.tsx:** compute `const entries = filterEntries(log.entries, activeTagIds)` per day (~l.68) and use `entries` for `.slice(0, 5)` and the `+N more` count (~l.91/102/103).
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean; `npm run build 2>&1 | tail -n 10` succeeds.

### Task 5: Manual verification (user)

- [ ] Add entries on 3–4 days with different tags (incl. a day with 8+ entries, a day with none).
- [ ] Monthly: counts match; rings show up to 3 most-used tags; hover (desktop) shows ≤5 entries + "+N more" + habits line; zero-entry day has no badge/hover; click opens that day in Daily.
- [ ] Summary strip: totals, `done/total (%)` (irrelevant/migrated tasks not counted), active days, tag chips sorted by count; clicking a chip filters.
- [ ] Filter: select 1 tag → Daily/Weekly/Monthly all narrow; select 2 → union; Clear → back. While filtered, drag-reorder is disabled in Daily; "No entries match" shows on days without a match.
- [ ] Delete a tag that is an active filter (Daily → tag selector) → filter clears itself.
- [ ] Prev/next month, 31-day month + padding days: summary excludes padding days. Mobile width 390px: cells readable (count + rings), no hover card. Light + dark.
- [ ] `npx tsx scripts/verify-month-stats.ts` → 6 PASS.

## Outcome
_(filled at completion)_
