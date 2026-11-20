# 07 — UX polish batch

## Spec
Shared: `@dnd-kit/core|sortable|utilities` installed (use `PointerSensor` w/ distance 6 + `TouchSensor` delay 200ms/tolerance 8 so mobile scroll still works; drag handle = grip icon, `touch-action: none` on handle only). Rules in CLAUDE.md apply (≤400 lines/file, outlines not fills, lucide icons, per-record merge: bump `updatedAt` on every mutation).

### Stream A — entries & views (files: entry-item, entry-input, daily-log, weekly-view, monthly-view, journal-store entry actions, new `lib/entry-dnd` if needed)
1. Strike-through only for `type==="task"` with complete/irrelevant. Notes/events never strike or fade; `cycleStatus` must no-op for non-tasks (and clicking their bullet does nothing status-wise).
2. Body text > 5 lines: clamp to 5 lines (`line-clamp-5`) with a "Show more / Show less" chevron toggle; only show toggle when text actually overflows (measure scrollHeight vs clientHeight).
3. Weekly view: entry text clamped to 2 lines (no expand).
4. Monthly view: cells show tasks, events, notes (type-distinct bullet glyph/count) and habits (dated + completed), not just tasks; mobile = compact counts. Day popover lists all.
5. Reorder entries within a day via drag (desktop+mobile) using `reorderEntries`. Weekly/monthly: drag an entry (task/event/note) onto another date cell to move it (new store action `moveEntry(fromDate,toDate,entryId)`: remove from source, append to target with new `order`, bump updatedAt; sync-safe).
6. Entry-input placeholder: random from a pool per mount (e.g. "start writing here :)", "what's on your mind?", "jot something down…") — put pool in `lib/placeholders.ts` (Stream B imports it).

### Stream B — habits, collections, search (files: habit-tracker, collections-view, command-palette, lib/types habit field, store habit/collection actions, `lib/placeholders.ts`)
1. Create habit / collection name inputs use random placeholders from `lib/placeholders.ts` (export `randomPlaceholder()`; Stream B owns the file; Stream A imports `randomPlaceholder`). Pick a new one each time the create form opens.
2. Drag-reorder habits (`reorderHabits`) and collections (add `reorderCollections`, give Collection an `order` field with migration default = index) and collection items (`reorderCollectionItems`). Desktop+mobile.
3. Habit optional date: `Habit.date?: string` (YYYY-MM-DD), settable in create/edit form (optional date input). Interpretation: a dated habit appears in the daily/weekly/monthly views only on that date in addition to its completion tracking; undated habits behave as now. Expose helper `getHabitsForDate(date)` in `lib/journal-helpers.ts` for Stream A views to call (Stream B writes it first; A's monthly/weekly use it — if absent when A needs it, A writes the same signature and B must not duplicate).
4. Search (command palette): also match habits (name), collections (name + item content), and tags (name; selecting a tag filters/navigates to entries with that tag if a filter exists, else lists entries tagged). Group results by type; selecting navigates to the right view.

### Stream C — chrome (files: sidebar, mobile-nav, settings-modal, sync-section, backup-section, app/globals.css spacing, app/page.tsx)
1. Remove dark-mode toggle from sidebar (keep in settings).
2. Settings modal: focus, zoom, dark/light in ONE compact row. Google Drive sync + export/import in one "Data" section.
3. Single central "Log out": if Google linked/signed in → Google sign-out (existing flow); if guest → clear guest session (existing guest logout path). Remove other logout buttons.
4. More vertical whitespace: bump spacing in daily log entries, section gaps, sidebar, settings (e.g. py/gap one step up); don't touch entry-item internals (Stream A owns).

## Plan
Three agents in parallel (disjoint files). Cross-stream contracts: `randomPlaceholder()` in `lib/placeholders.ts` (B), `getHabitsForDate` (B), `moveEntry` (A).

## Outcome
(pending)
