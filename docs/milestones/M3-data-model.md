# M3 — Data Model & Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Checkbox steps. **Never commit** (user does). Don't run test suites. Scripts named `verify-*.ts` print PASS/FAIL — **ask the user to run them**; agents only run `tsc`/`build`.

**Goal:** One local journal per device with mergeable records (`updatedAt`, `order`, `tombstones`), safe migration of existing data, JSON export/import, cross-tab safety, and the guest-name bug eliminated.

**Architecture:** A single IndexedDB key `bj-journal` holds persisted state (`version: 2`). Pure modules (`journal-helpers`, `sync/merge`, `migrations`, `backup`) carry the logic; the store only calls them. Legacy stores (`bullet-journal-storage`, `bj-guest-*`, `bj-google-*`) are merged once into `bj-journal` and left untouched for rollback. Drive sync is **disabled** until M6.

**Tech Stack:** Zustand 5 persist, IndexedDB, zod 3, date-fns, BroadcastChannel.

**Spec:** `docs/milestones/00-design-decisions.md` (D3, D4, D5, D10)

## Global Constraints
- ISO timestamps always from `new Date().toISOString()` (lexicographic compare is the merge rule).
- Never delete legacy IndexedDB keys in this milestone.
- `lib/sync/merge.ts` and `lib/journal-data.ts` use `import type` only (so `npx tsx` can run them without the `@/` alias).
- Source files ≤400 lines soft, 600 hard. `lib/journal-store.ts` is currently 607 → must end ≤600 (Task 3 step 6).
- **Do not deploy between M3 and M6** (Drive sync is off in between).

## Review Focus
- Two tabs open: tab A edits must not be clobbered by a stale tab B write (cross-tab).
- Two devices create the preset tags independently → merged result must not show duplicate tags.
- Delete on device A, then edit-only on B before seeing it: newer `updatedAt` than the tombstone resurrects; otherwise stays deleted.
- `crypto.randomUUID` is undefined on plain-http LAN origins → id creation must not crash.
- Late evening/early morning in UTC+8: "today" and streaks must use the **local** date, not UTC.
- Imported file that is not a backup (random JSON) → rejected with a message, state unchanged.
- Legacy habit completions have no `updatedAt`; legacy entries have no `order`.

---

### Task 0: Safety dump of current browser data (user, 2 min, before any code change)

- [ ] **Step 1:** In the running **old** app, DevTools console, paste:
```js
(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('BulletJournalDB');q.onsuccess=()=>r(q.result)});const dump={};for(const s of ['data','meta']){dump[s]={};await new Promise(res=>{const c=db.transaction(s).objectStore(s).openCursor();c.onsuccess=()=>{const cur=c.result;if(cur){dump[s][cur.key]=cur.value;cur.continue()}else res()}})};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(dump)],{type:'application/json'}));a.download='bj-raw-dump.json';a.click()})()
```
- [ ] **Step 2:** Keep `bj-raw-dump.json` outside the repo (it contains a Google access token; delete it after M3 is verified).
- [ ] **Step 3 (reproduce the bug, record in `## Outcome`):** Note the current `meta` entries (`activeUserKey`, `guestId`, `user/*`) and `data` keys, then open a **new tab** and record: name prompt shown? which keys exist? Repeat after "hard reload". This tells us the failing link; Task 4 removes that code path regardless, and Task 7 re-runs this scenario on the new code.

### Task 1: Types, helpers, journal data

**Files:** Modify `lib/types.ts`; Create `lib/journal-helpers.ts`, `lib/journal-data.ts`

- [ ] **Step 1:** `lib/types.ts` — replace the interfaces below (keep the rest):
```ts
export interface BulletEntry {
  id: string
  type: BulletType
  status: BulletStatus
  title?: string
  content: string
  indent: number
  tagIds?: string[]
  order: number
  createdAt: string
  updatedAt: string
}
export interface Tag { id: string; name: string; color: string; createdAt: string; updatedAt: string }
export interface Habit { id: string; name: string; icon: string; color: string; order: number; createdAt: string; updatedAt: string }
export interface HabitCompletion { habitId: string; date: string; completed: boolean; updatedAt: string }
export interface Collection { id: string; name: string; icon: string; items: CollectionItem[]; createdAt: string; updatedAt: string }
export interface CollectionItem { id: string; content: string; completed: boolean; order: number; createdAt: string; updatedAt: string }
export type Tombstones = Record<string, string> // record id -> ISO deletedAt

export interface JournalState {
  dailyLogs: Record<string, DailyLog>
  tags: Tag[]
  habits: Habit[]
  habitCompletions: HabitCompletion[]
  collections: Collection[]
  userName: string
  userNameUpdatedAt: string
  tombstones: Tombstones
  settings: { showDots: boolean; showLines: boolean; focusMode: boolean; zoomLevel: number }
  googleEmail: string | null
  syncAccountId: string | null // Google account this journal is linked to (kept after sign-out)
  lastSyncTime: string | null
}
```
- [ ] **Step 2:** Create `lib/journal-data.ts`:
```ts
import type { Collection, DailyLog, Habit, HabitCompletion, Tag, Tombstones } from "./types"

/** The syncable/exportable subset of the journal. Settings are device-local and excluded. */
export interface JournalData {
  dailyLogs: Record<string, DailyLog>
  tags: Tag[]
  habits: Habit[]
  habitCompletions: HabitCompletion[]
  collections: Collection[]
  userName: string
  userNameUpdatedAt: string
  tombstones: Tombstones
}

export const emptyJournalData = (): JournalData => ({
  dailyLogs: {},
  tags: [],
  habits: [],
  habitCompletions: [],
  collections: [],
  userName: "",
  userNameUpdatedAt: "1970-01-01T00:00:00.000Z",
  tombstones: {},
})

export const pickJournalData = (s: JournalData): JournalData => ({
  dailyLogs: s.dailyLogs,
  tags: s.tags,
  habits: s.habits,
  habitCompletions: s.habitCompletions,
  collections: s.collections,
  userName: s.userName,
  userNameUpdatedAt: s.userNameUpdatedAt,
  tombstones: s.tombstones,
})
```
- [ ] **Step 2b:** In `lib/tag-presets.ts` change the preset type to `Omit<Tag, "id" | "createdAt" | "updatedAt">[]` (otherwise `initializePresetTags` fails to type-check).
- [ ] **Step 3:** Create `lib/journal-helpers.ts`:
```ts
import { format } from "date-fns"
import { tagPresets } from "./tag-presets"
import type { HabitCompletion, Tag, Tombstones } from "./types"

export const EPOCH = "1970-01-01T00:00:00.000Z"

/** randomUUID needs a secure context; fall back so plain-http LAN testing doesn't crash. */
export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

export const nowIso = (): string => new Date().toISOString()

/** Local calendar date (NOT UTC) as YYYY-MM-DD. */
export const localDateStr = (d: Date = new Date()): string => format(d, "yyyy-MM-dd")

export const nextOrder = (list: { order: number }[]): number => list.reduce((m, r) => Math.max(m, r.order), -1) + 1

export function addTombstones(t: Tombstones, ids: string[]): Tombstones {
  const at = nowIso()
  const next = { ...t }
  for (const id of ids) next[id] = at
  return next
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Rewrites `order` to the array index; only changed records get a new updatedAt. */
export function reindex<T extends { order: number; updatedAt: string }>(list: T[]): T[] {
  const at = nowIso()
  return list.map((r, i) => (r.order === i ? r : { ...r, order: i, updatedAt: at }))
}

/** Deterministic ids so independent devices create the *same* preset tags (merge-safe). */
export const presetTagId = (name: string): string => `preset-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

export const initializePresetTags = (): Tag[] =>
  tagPresets.map((p) => ({ ...p, id: presetTagId(p.name), createdAt: EPOCH, updatedAt: EPOCH }))

export function calcStreak(completions: HabitCompletion[], habitId: string, today: Date = new Date()): number {
  const done = new Set(completions.filter((c) => c.habitId === habitId && c.completed).map((c) => c.date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (done.has(localDateStr(d))) streak++
    else if (i > 0) break
  }
  return streak
}
```
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` — errors are expected only in files that use the old types (fixed in Tasks 3–4).

### Task 2: Merge function + verify script

**Files:** Create `lib/sync/merge.ts`, `scripts/verify-merge.ts`

- [ ] **Step 1:** Create `lib/sync/merge.ts`:
```ts
import type { JournalData } from "../journal-data"
import type { BulletEntry, Collection, DailyLog, Tag, Tombstones } from "../types"

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

interface Rec { id: string; updatedAt: string }
interface Ordered extends Rec { order: number; createdAt: string }

/** Newest updatedAt wins; exact ties break on content so merge stays commutative. */
function pick<T extends { updatedAt: string }>(a: T, b: T): T {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt > a.updatedAt ? b : a
  return JSON.stringify(b) > JSON.stringify(a) ? b : a
}

function mergeById<T extends Rec>(a: T[], b: T[]): Map<string, T> {
  const out = new Map<string, T>()
  for (const r of [...a, ...b]) {
    const cur = out.get(r.id)
    out.set(r.id, cur ? pick(cur, r) : r)
  }
  return out
}

/** A record is dead if a tombstone is at least as new as its last update (edit-after-delete resurrects). */
function live<T extends Rec>(m: Map<string, T>, t: Tombstones): T[] {
  return [...m.values()].filter((r) => !(r.id in t && t[r.id] >= r.updatedAt))
}

const byOrder = <T extends Ordered>(list: T[]): T[] =>
  list.sort((x, y) => x.order - y.order || x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id))

/** Collapse tags that share a name (case-insensitive): keep the earliest, remap the rest. */
function canonicalTags(tags: Tag[]): { tags: Tag[]; remap: Map<string, string> } {
  const sorted = [...tags].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id))
  const keep = new Map<string, Tag>()
  const remap = new Map<string, string>()
  for (const t of sorted) {
    const k = t.name.trim().toLowerCase()
    const first = keep.get(k)
    if (!first) keep.set(k, t)
    else remap.set(t.id, first.id)
  }
  return { tags: [...keep.values()].sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id)), remap }
}

export function mergeJournals(a: JournalData, b: JournalData, now: number = Date.now()): JournalData {
  const tombstones: Tombstones = {}
  for (const [id, at] of [...Object.entries(a.tombstones), ...Object.entries(b.tombstones)]) {
    if (now - Date.parse(at) > TOMBSTONE_TTL_MS) continue
    if (!(id in tombstones) || at > tombstones[id]) tombstones[id] = at
  }

  const { tags, remap } = canonicalTags(live(mergeById(a.tags, b.tags), tombstones))
  const tagIds = new Set(tags.map((t) => t.id))
  const fixTags = (e: BulletEntry): BulletEntry => {
    if (!e.tagIds) return e
    const ids = [...new Set(e.tagIds.map((id) => remap.get(id) ?? id).filter((id) => tagIds.has(id)))]
    return { ...e, tagIds: ids.length ? ids : undefined }
  }

  const dailyLogs: Record<string, DailyLog> = {}
  for (const date of new Set([...Object.keys(a.dailyLogs), ...Object.keys(b.dailyLogs)])) {
    const entries = byOrder(live(mergeById(a.dailyLogs[date]?.entries ?? [], b.dailyLogs[date]?.entries ?? []), tombstones)).map(fixTags)
    if (entries.length) dailyLogs[date] = { date, entries }
  }

  const habits = byOrder(live(mergeById(a.habits, b.habits), tombstones))
  const habitIds = new Set(habits.map((h) => h.id))

  const completions = new Map<string, (typeof a.habitCompletions)[number]>()
  for (const c of [...a.habitCompletions, ...b.habitCompletions]) {
    const k = `${c.habitId}|${c.date}`
    const cur = completions.get(k)
    completions.set(k, cur ? pick(cur, c) : c)
  }
  const habitCompletions = [...completions.values()]
    .filter((c) => habitIds.has(c.habitId))
    .sort((x, y) => x.date.localeCompare(y.date) || x.habitId.localeCompare(y.habitId))

  const colA = new Map(a.collections.map((c) => [c.id, c]))
  const colB = new Map(b.collections.map((c) => [c.id, c]))
  const collections: Collection[] = live(mergeById(a.collections, b.collections), tombstones)
    .map((c) => ({
      ...c,
      items: byOrder(live(mergeById(colA.get(c.id)?.items ?? [], colB.get(c.id)?.items ?? []), tombstones)),
    }))
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id))

  const nameWinner =
    a.userNameUpdatedAt !== b.userNameUpdatedAt
      ? b.userNameUpdatedAt > a.userNameUpdatedAt ? b : a
      : b.userName > a.userName ? b : a

  return {
    dailyLogs,
    tags,
    habits,
    habitCompletions,
    collections,
    userName: nameWinner.userName,
    userNameUpdatedAt: nameWinner.userNameUpdatedAt,
    tombstones,
  }
}
```
- [ ] **Step 2:** Create `scripts/verify-merge.ts`:
```ts
import assert from "node:assert"
import { mergeJournals } from "../lib/sync/merge"
import { emptyJournalData, type JournalData } from "../lib/journal-data"

const T = (m: number) => new Date(Date.now() - 1000 * 60 * m).toISOString() // m minutes ago
const entry = (id: string, content: string, m: number, extra = {}) =>
  ({ id, type: "note" as const, status: "complete" as const, content, indent: 0, order: 0, createdAt: T(100), updatedAt: T(m), ...extra })
const tag = (id: string, name: string, created: string) => ({ id, name, color: "#888", createdAt: created, updatedAt: created })
const withEntries = (es: ReturnType<typeof entry>[]): JournalData => ({ ...emptyJournalData(), dailyLogs: { "2026-01-01": { date: "2026-01-01", entries: es } } })
const ids = (d: JournalData) => (d.dailyLogs["2026-01-01"]?.entries ?? []).map((e) => e.id).sort().join(",")
const j = (d: JournalData) => JSON.stringify(d)

const checks: [string, () => void][] = [
  ["union of disjoint entries", () => assert.equal(ids(mergeJournals(withEntries([entry("a", "x", 5)]), withEntries([entry("b", "y", 5)]))), "a,b")],
  ["newest edit wins", () => assert.equal(mergeJournals(withEntries([entry("a", "old", 10)]), withEntries([entry("a", "new", 1)])).dailyLogs["2026-01-01"].entries[0].content, "new")],
  ["delete propagates", () => {
    const del = { ...withEntries([]), tombstones: { a: T(1) } }
    assert.equal(ids(mergeJournals(withEntries([entry("a", "x", 10)]), del)), "")
  }],
  ["edit after delete resurrects", () => {
    const del = { ...withEntries([]), tombstones: { a: T(10) } }
    assert.equal(ids(mergeJournals(withEntries([entry("a", "x", 1)]), del)), "a")
  }],
  ["idempotent", () => { const a = withEntries([entry("a", "x", 5), entry("b", "y", 3, { order: 1 })]); assert.equal(j(mergeJournals(a, a)), j(mergeJournals(mergeJournals(a, a), a))) }],
  ["commutative", () => {
    const a = withEntries([entry("a", "x", 5)]); const b = withEntries([entry("a", "y", 5), entry("b", "z", 2)])
    assert.equal(j(mergeJournals(a, b)), j(mergeJournals(b, a)))
  }],
  ["associative", () => {
    const a = withEntries([entry("a", "1", 9)]); const b = withEntries([entry("a", "2", 5), entry("b", "x", 4)]); const c = { ...withEntries([entry("c", "3", 1)]), tombstones: { b: T(2) } }
    assert.equal(j(mergeJournals(mergeJournals(a, b), c)), j(mergeJournals(a, mergeJournals(b, c))))
  }],
  ["same-name tags collapse, entries remapped", () => {
    const a = { ...withEntries([entry("a", "x", 5, { tagIds: ["t1"] })]), tags: [tag("t1", "Work", T(50))] }
    const b = { ...withEntries([entry("b", "y", 5, { tagIds: ["t2"] })]), tags: [tag("t2", "work", T(40))] }
    const m = mergeJournals(a, b)
    assert.equal(m.tags.length, 1)
    assert.ok(m.dailyLogs["2026-01-01"].entries.every((e) => e.tagIds?.[0] === "t1"))
  }],
  ["deleted habit drops completions", () => {
    const h = { id: "h", name: "n", icon: "i", color: "#000", order: 0, createdAt: T(50), updatedAt: T(50) }
    const a = { ...emptyJournalData(), habits: [h], habitCompletions: [{ habitId: "h", date: "2026-01-01", completed: true, updatedAt: T(5) }] }
    const b = { ...emptyJournalData(), tombstones: { h: T(1) } }
    assert.equal(mergeJournals(a, b).habitCompletions.length, 0)
  }],
]
let fail = 0
for (const [name, fn] of checks) {
  try { fn(); console.log(`PASS ${name}`) } catch (e) { fail++; console.log(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`) }
}
process.exit(fail ? 1 : 0)
```
- [ ] **Verify (user runs):** `npx tsx scripts/verify-merge.ts` → 9 `PASS` lines, no `FAIL`.

### Task 3: Store — mergeable records, tombstones, single key

**Files:** Modify `lib/journal-store.ts`

- [ ] **Step 1:** Delete the local `generateId`, `generateGuestId`, `initializePresetTags`, `GOOGLE_SYNC_ENABLED` and the `export { generateGuestId }` line from the store (**keep the `GOOGLE_CONFIG` export as-is**; M6 moves it). Replace `getToday` with `localDateStr` (see Step 7). Import from helpers: `import { newId, nowIso, nextOrder, addTombstones, moveItem, reindex, calcStreak, initializePresetTags, localDateStr } from "./journal-helpers"`.
- [ ] **Step 2:** Replace the initial state (lines ~113–135) with:
```ts
dailyLogs: {},
tags: initializePresetTags(),
habits: [],
habitCompletions: [],
collections: [],
userName: "",
userNameUpdatedAt: "1970-01-01T00:00:00.000Z",
tombstones: {},
settings: { showDots: true, showLines: false, focusMode: false, zoomLevel: 1 },
googleEmail: null as string | null,
syncAccountId: null as string | null,
lastSyncTime: null as string | null,
```
- [ ] **Step 3:** Rewrite these actions (all others keep behavior; `id: generateId()` → `newId()` everywhere; every `createdAt` creator also sets `updatedAt: nowIso()`):
```ts
addEntry: (date, type, content, indent = 0, tagIds = [], title) => {
  const now = nowIso()
  set((state) => {
    const log = state.dailyLogs[date] || { date, entries: [] }
    const entry: BulletEntry = {
      id: newId(), type, status: type === "task" ? "open" : "complete", title, content, indent,
      tagIds: tagIds.length > 0 ? tagIds : undefined, order: nextOrder(log.entries), createdAt: now, updatedAt: now,
    }
    return { dailyLogs: { ...state.dailyLogs, [date]: { ...log, entries: [...log.entries, entry] } } }
  })
},

deleteEntry: (date, entryId) => {
  set((state) => {
    const log = state.dailyLogs[date]
    if (!log) return state
    return {
      dailyLogs: { ...state.dailyLogs, [date]: { ...log, entries: log.entries.filter((e) => e.id !== entryId) } },
      tombstones: addTombstones(state.tombstones, [entryId]),
    }
  })
},

deleteTag: (tagId) => {
  set((state) => {
    const at = nowIso()
    return {
      tags: state.tags.filter((t) => t.id !== tagId),
      tombstones: addTombstones(state.tombstones, [tagId]),
      dailyLogs: Object.fromEntries(
        Object.entries(state.dailyLogs).map(([date, log]) => [
          date,
          { ...log, entries: log.entries.map((e) => (e.tagIds?.includes(tagId) ? { ...e, tagIds: e.tagIds.filter((id) => id !== tagId), updatedAt: at } : e)) },
        ]),
      ),
    }
  })
},

deleteHabit: (habitId) => {
  set((state) => ({
    habits: state.habits.filter((h) => h.id !== habitId),
    habitCompletions: state.habitCompletions.filter((c) => c.habitId !== habitId),
    tombstones: addTombstones(state.tombstones, [habitId]),
  }))
},

toggleHabitCompletion: (habitId, date) => {
  set((state) => {
    const updatedAt = nowIso()
    const existing = state.habitCompletions.find((c) => c.habitId === habitId && c.date === date)
    return {
      habitCompletions: existing
        ? state.habitCompletions.map((c) => (c === existing ? { ...c, completed: !c.completed, updatedAt } : c))
        : [...state.habitCompletions, { habitId, date, completed: true, updatedAt }],
    }
  })
},

getHabitStreak: (habitId) => calcStreak(get().habitCompletions, habitId),

deleteCollection: (collectionId) => {
  set((state) => {
    const col = state.collections.find((c) => c.id === collectionId)
    return {
      collections: state.collections.filter((c) => c.id !== collectionId),
      tombstones: addTombstones(state.tombstones, [collectionId, ...(col?.items.map((i) => i.id) ?? [])]),
    }
  })
},

deleteCollectionItem: (collectionId, itemId) => {
  set((state) => ({
    collections: state.collections.map((c) => (c.id === collectionId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c)),
    tombstones: addTombstones(state.tombstones, [itemId]),
  }))
},

reorderEntries: (date, fromIndex, toIndex) => {
  set((state) => {
    const log = state.dailyLogs[date]
    if (!log || fromIndex === toIndex) return state
    return { dailyLogs: { ...state.dailyLogs, [date]: { ...log, entries: reindex(moveItem(log.entries, fromIndex, toIndex)) } } }
  })
},
reorderHabits: (fromIndex, toIndex) => {
  set((state) => (fromIndex === toIndex ? state : { habits: reindex(moveItem(state.habits, fromIndex, toIndex)) }))
},
reorderCollectionItems: (collectionId, fromIndex, toIndex) => {
  set((state) => {
    const col = state.collections.find((c) => c.id === collectionId)
    if (!col || fromIndex === toIndex) return state
    const items = reindex(moveItem(col.items, fromIndex, toIndex))
    return { collections: state.collections.map((c) => (c.id === collectionId ? { ...c, items } : c)) }
  })
},

setUserName: (name) => set({ userName: name.trim(), userNameUpdatedAt: nowIso() }),
```
Trivial edits: `addHabit` → `order: nextOrder(state.habits)` inside `set((state) => …)` + `updatedAt`; `addTag`, `addCollection` → `updatedAt`; `addCollectionItem` → `order: nextOrder(c.items)`, `updatedAt`; `toggleCollectionItem` → item `updatedAt: nowIso()`; `addTagToEntry`/`removeTagFromEntry` → modified entry gets `updatedAt: nowIso()`; `migrateIncompleteTasks` → originals `{ ...e, status: "migrated", updatedAt: now }`, copies `{ ...e, id: newId(), order: nextOrder(toLog.entries) + i, createdAt: now, updatedAt: now }` (use index `i` from `.map((e, i) => …)`).
- [ ] **Step 4:** Delete the auth/sync actions and interface members: `setAuthMethod`, `setGuestId`, `setGoogleUser`, `clearGoogleAuth`, `setGoogleDriveSyncEnabled`, `setLastSyncTime`, `getSyncStatus`, and their entries in `resetStore`. Add `setLinkedAccount: (accountId: string | null, email: string | null) => void` → `set({ syncAccountId: accountId, googleEmail: email })` and keep `setLastSyncTime` (M6 uses both). `resetStore` resets to the Step 2 initial values.
- [ ] **Step 5:** Persist options become:
```ts
{
  name: "bj-journal",
  version: 2,
  storage: createZustandStorage(),
  skipHydration: true,
}
```
(remove the M1 `partialize`; the new state has no tokens — `isSyncing`, tokens, `authMethod`, `guestId`, `googleId` do not exist anymore. Functions are not serialized.)
- [ ] **Step 6:** `wc -l lib/journal-store.ts` must be ≤600; if not, move any remaining pure helper out to `journal-helpers.ts`.
- [ ] **Step 7 (UTC-date bug):** `grep -rnE "toISOString\(\)\.(split|slice|substring)" app components lib --include='*.ts' --include='*.tsx'` — every hit that derives a *calendar date* (not a timestamp) becomes `localDateStr(...)` (import from `@/lib/journal-helpers`). Timestamps (`createdAt`/`updatedAt`) stay `toISOString()`.
- [ ] **Verify:** `npx tsc --noEmit | tail -n 30` — remaining errors only in files using removed fields (fixed in Task 4).

### Task 4: Storage simplification, legacy migration, one-journal bootstrap

**Files:** Modify `lib/storage/storage.ts`, `lib/storage/zustand-adapter.ts`, `app/page.tsx`, `components/journal/setup-modal.tsx`, `components/journal/settings-modal.tsx`, `components/journal/sidebar.tsx` (as tsc dictates); Create `lib/storage/legacy-migration.ts`, `lib/storage/cross-tab.ts`, `components/journal/backup-section.tsx`, `lib/backup.ts`; Delete `lib/google/auto-sync.ts`, `lib/google/conflict-resolution.ts`, `components/journal/sync-conflict-modal.tsx`

- [ ] **Step 1 — `storage.ts`:** delete `registerUser`, `getUser`, `listUsers`; add:
```ts
  /** All keys in the data store (used once by the legacy migration). */
  async listDataKeys(): Promise<string[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      const req = db.transaction(DATA_STORE, "readonly").objectStore(DATA_STORE).getAllKeys()
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result as string[])
    })
  }
```
Update the header comment (keys are now `bj-journal` + legacy keys; meta holds `schema` and `googleAuth/*`).
- [ ] **Step 2 — `cross-tab.ts`:**
```ts
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("bj-journal") : null

export const announceWrite = (): void => channel?.postMessage("write")

export function onRemoteWrite(cb: () => void): () => void {
  if (!channel) return () => {}
  const handler = (e: MessageEvent) => { if (e.data === "write") cb() }
  channel.addEventListener("message", handler)
  return () => channel.removeEventListener("message", handler)
}
```
- [ ] **Step 3 — `zustand-adapter.ts`:** delete `activeKey`, `setActiveStorageKey`, `clearActiveStorageKey`, `getPersistedActiveKey`, `persistGuestId`, `getPersistedGuestId`, `clearPersistedGuestId`, `registerUser`, `findGuestByName`. Keep the three Google-token helpers (`persistGoogleToken`, `getPersistedGoogleToken`, `clearPersistedGoogleToken`). Replace `createZustandStorage` with:
```ts
export function createZustandStorage<T>(): PersistStorage<T> {
  let last: string | null = null // skip identical writes: breaks cross-tab rehydrate→write→broadcast loops
  return {
    getItem: async (key) => {
      try {
        const value = await getStorageProvider().getItem(key)
        last = value
        return value ? (JSON.parse(value) as StorageValue<T>) : null
      } catch (error) {
        console.error("Failed to get item from storage:", error)
        return null
      }
    },
    setItem: async (key, value) => {
      try {
        const serialized = JSON.stringify(value)
        if (serialized === last) return
        last = serialized
        await getStorageProvider().setItem(key, serialized)
        announceWrite()
      } catch (error) {
        console.error("Failed to set item in storage:", error)
      }
    },
    removeItem: async (key) => {
      last = null
      await getStorageProvider().removeItem(key).catch((e) => console.error("Failed to remove item from storage:", e))
    },
  }
}
```
(import `announceWrite` from `./cross-tab`; update header comment.)
- [ ] **Step 4 — `legacy-migration.ts`:**
```ts
import { getStorageProvider } from "./storage"
import { emptyJournalData, type JournalData } from "../journal-data"
import { mergeJournals } from "../sync/merge"
import { EPOCH, nowIso } from "../journal-helpers"
import type { BulletEntry } from "../types"

const isLegacyKey = (k: string) => k === "bullet-journal-storage" || k.startsWith("bj-guest-") || k.startsWith("bj-google-")

/** Fill fields that pre-v2 records lack. */
export function upgradeLegacyState(s: any): { data: JournalData; settings: unknown; entryCount: number } {
  const ts = (r: any) => r?.updatedAt ?? r?.createdAt ?? EPOCH
  const logs: JournalData["dailyLogs"] = {}
  let entryCount = 0
  for (const [date, log] of Object.entries<any>(s.dailyLogs ?? {})) {
    const entries: BulletEntry[] = (log.entries ?? []).map((e: any, i: number) => ({ ...e, order: e.order ?? i, updatedAt: ts(e), createdAt: e.createdAt ?? EPOCH }))
    entryCount += entries.length
    if (entries.length) logs[date] = { date, entries }
  }
  const data: JournalData = {
    ...emptyJournalData(),
    dailyLogs: logs,
    tags: (s.tags ?? []).map((t: any) => ({ ...t, createdAt: t.createdAt ?? EPOCH, updatedAt: ts(t) })),
    habits: (s.habits ?? []).map((h: any, i: number) => ({ ...h, order: h.order ?? i, createdAt: h.createdAt ?? EPOCH, updatedAt: ts(h) })),
    habitCompletions: (s.habitCompletions ?? []).map((c: any) => ({ ...c, updatedAt: c.updatedAt ?? EPOCH })),
    collections: (s.collections ?? []).map((c: any) => ({
      ...c,
      createdAt: c.createdAt ?? EPOCH,
      updatedAt: ts(c),
      items: (c.items ?? []).map((it: any, i: number) => ({ ...it, order: it.order ?? i, createdAt: it.createdAt ?? EPOCH, updatedAt: ts(it) })),
    })),
    userName: s.userName ?? "",
    userNameUpdatedAt: s.userName ? nowIso() : EPOCH,
  }
  return { data, settings: s.settings, entryCount }
}

/** One-time, non-destructive: merge every legacy store into `bj-journal`. Legacy keys are left in place. */
export async function migrateLegacyStores(): Promise<void> {
  const p = getStorageProvider()
  if ((await p.getMeta("schema")) === "2") return

  if (!(await p.getItem("bj-journal"))) {
    const found: ReturnType<typeof upgradeLegacyState>[] = []
    for (const key of (await p.listDataKeys()).filter(isLegacyKey)) {
      try {
        const raw = await p.getItem(key)
        const state = raw ? JSON.parse(raw)?.state : null
        if (state) found.push(upgradeLegacyState(state))
      } catch (e) {
        console.error(`Skipping unreadable legacy store ${key}`, e)
      }
    }
    if (found.length) {
      const merged = found.reduce((acc, f) => mergeJournals(acc, f.data), emptyJournalData())
      const richest = [...found].sort((a, b) => b.entryCount - a.entryCount)[0]
      const named = found.filter((f) => f.data.userName).sort((a, b) => b.entryCount - a.entryCount)[0]
      const state = {
        ...merged,
        userName: named?.data.userName ?? merged.userName,
        userNameUpdatedAt: named ? nowIso() : merged.userNameUpdatedAt,
        settings: richest.settings ?? { showDots: true, showLines: false, focusMode: false, zoomLevel: 1 },
        googleEmail: null,
        syncAccountId: null,
        lastSyncTime: null,
      }
      await p.setItem("bj-journal", JSON.stringify({ state, version: 2 }))
    }
  }
  await p.setMeta("schema", "2")
}
```
- [ ] **Step 5 — `lib/backup.ts`:**
```ts
import { z } from "zod"
import { useJournalStore } from "./journal-store"
import { pickJournalData, type JournalData } from "./journal-data"
import { mergeJournals } from "./sync/merge"
import { localDateStr } from "./journal-helpers"

const iso = z.string()
const entry = z.object({
  id: z.string(), type: z.enum(["task", "event", "note"]),
  status: z.enum(["open", "complete", "migrated", "scheduled", "irrelevant"]),
  title: z.string().optional(), content: z.string(), indent: z.number(),
  tagIds: z.array(z.string()).optional(), order: z.number(), createdAt: iso, updatedAt: iso,
})
const item = z.object({ id: z.string(), content: z.string(), completed: z.boolean(), order: z.number(), createdAt: iso, updatedAt: iso })
const dataSchema = z.object({
  dailyLogs: z.record(z.object({ date: z.string(), entries: z.array(entry) })),
  tags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), createdAt: iso, updatedAt: iso })),
  habits: z.array(z.object({ id: z.string(), name: z.string(), icon: z.string(), color: z.string(), order: z.number(), createdAt: iso, updatedAt: iso })),
  habitCompletions: z.array(z.object({ habitId: z.string(), date: z.string(), completed: z.boolean(), updatedAt: iso })),
  collections: z.array(z.object({ id: z.string(), name: z.string(), icon: z.string(), items: z.array(item), createdAt: iso, updatedAt: iso })),
  userName: z.string(), userNameUpdatedAt: iso, tombstones: z.record(z.string()),
})
const backupSchema = z.object({ app: z.literal("bullet-journal"), schema: z.literal(2), exportedAt: iso, data: dataSchema })

export const exportBackup = (): string =>
  JSON.stringify({ app: "bullet-journal", schema: 2, exportedAt: new Date().toISOString(), data: pickJournalData(useJournalStore.getState()) }, null, 2)

export function downloadBackup(): void {
  const url = URL.createObjectURL(new Blob([exportBackup()], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `bullet-journal-${localDateStr()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** Throws a user-readable Error if the file isn't a valid backup; state is untouched on failure. */
export function importBackup(json: string, mode: "merge" | "replace"): void {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error("That file isn't valid JSON.") }
  const result = backupSchema.safeParse(parsed)
  if (!result.success) throw new Error("That file isn't a Bullet Journal backup (or is from an incompatible version).")
  const incoming = result.data.data as JournalData
  const next = mode === "replace" ? incoming : mergeJournals(pickJournalData(useJournalStore.getState()), incoming)
  useJournalStore.setState(next)
}
```
- [ ] **Step 6 — `backup-section.tsx`** (Settings block; uses existing `Button`, `sonner` toast):
```tsx
"use client"

import { useRef } from "react"
import { Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { downloadBackup, importBackup } from "@/lib/backup"

export function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      importBackup(await file.text(), "merge")
      toast.success("Backup merged into your journal")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Backup</h3>
      <p className="text-xs text-muted-foreground">Export your journal as JSON, or merge a backup back in.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadBackup}><Download className="w-4 h-4 mr-2" />Export JSON</Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Import JSON</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  )
}
```
- [ ] **Step 7 — `setup-modal.tsx`:** replace the whole file with a name-only dialog:
```tsx
"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface SetupModalProps {
  open: boolean
  onComplete: (name: string) => void
}

export function SetupModal({ open, onComplete }: SetupModalProps) {
  const [name, setName] = useState("")
  const submit = () => name.trim() && onComplete(name.trim())

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Welcome to your journal</DialogTitle>
          <DialogDescription>What should we call you? You can change it later in Settings.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Your name" />
        <Button onClick={submit} disabled={!name.trim()}>Start journaling</Button>
      </DialogContent>
    </Dialog>
  )
}
```
- [ ] **Step 8 — `app/page.tsx`:** (a) imports: drop `generateGuestId`, `GOOGLE_*`, `initializeGoogle`, `restorePersistedToken`, `getAccessToken`, `debouncedSync`, `cancelSync`, `downloadFromDrive`, `toast`, and every `zustand-adapter` import; add `migrateLegacyStores` from `@/lib/storage/legacy-migration` and `onRemoteWrite` from `@/lib/storage/cross-tab`. (b) Destructure only `settings, toggleSetting, userName, setUserName`. (c) Replace the first three `useEffect`s (init, initGoogle, subscribe) and `handleSetupComplete` with:
```tsx
useEffect(() => {
  const init = async () => {
    await migrateLegacyStores()
    await useJournalStore.persist.rehydrate()
    setMounted(true)
  }
  init()
  return onRemoteWrite(() => { useJournalStore.persist.rehydrate() })
}, [])
```
(d) `<SetupModal open={true} onComplete={setUserName} />`.
- [ ] **Step 9 — `settings-modal.tsx`:** remove imports/state/handlers/JSX for sign-in, sync, merge-strategy, undo, logout, `SyncConflictModal`, `signInWithGoogle`, `uploadToDrive`, `getLastSyncTime`, `registerUser`, `setActiveStorageKey`, etc. (anchors: `grep -nE "Google|Sync|Merge|Undo|Logout|registerUser" components/journal/settings-modal.tsx`). Keep theme, zoom, dots/lines, focus mode, name edit (`setUserName(nameInput)` only). Add `<BackupSection />` below the name field. Fix any `sidebar.tsx`/other tsc errors by removing `authMethod`/`googleId` displays (M6 re-adds a sync status).
- [ ] **Step 10:** `rm lib/google/auto-sync.ts lib/google/conflict-resolution.ts components/journal/sync-conflict-modal.tsx`; `grep -rn "auto-sync\|conflict-resolution\|sync-conflict" app components lib` → no hits.
- [ ] **Verify:** `npx tsc --noEmit | tail -n 20` clean; `npm run build 2>&1 | tail -n 15` succeeds.

### Task 5: Manual verification (user)

- [ ] **Migration:** Start `npm run dev` with the browser that has old data → journal opens **without** a name prompt, all entries/habits/collections present, name correct. DevTools → IndexedDB → `data` has `bj-journal` plus the untouched legacy keys; `meta.schema` = `2`.
- [ ] **New-tab bug (Task 0 scenario):** open a second tab, then a hard reload → no name prompt, entries visible. Clear site data → the name dialog shows once; reload → it does not return.
- [ ] **Cross-tab:** add an entry in tab A → appears in tab B within ~1s without reload; add another in B → appears in A. Idle 30s: IndexedDB `bj-journal` doesn't flicker/rewrite (no write storm).
- [ ] **Tombstones/order:** delete an entry, reorder two entries, inspect `bj-journal` JSON: `tombstones` has the id; moved entries have changed `order`/`updatedAt`; new records have UUID ids (`crypto.randomUUID()` format).
- [ ] **Export/import:** Settings → Export JSON; delete an entry; Import the file → entry stays deleted (tombstone beats older copy); import `package.json` → toast error, nothing changes.
- [ ] **Local date:** set the OS clock/timezone to UTC+8 at 01:00 local (or reason through `localDateStr`): Daily Log opens on the local date; habit streak counts it.
- [ ] `npx tsx scripts/verify-merge.ts` → all PASS. Then delete `bj-raw-dump.json`.

## Outcome
_(filled in at completion: bug-repro findings from Task 0, deviations)_
