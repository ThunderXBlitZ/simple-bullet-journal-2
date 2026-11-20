import assert from "node:assert"
import { mergeJournals } from "../lib/sync/merge"
import { journalDataSchema } from "../lib/schema"
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
  ["schema round-trip keeps Habit.date and Collection.order", () => {
    const habit = { id: "h", name: "n", icon: "leaf", color: "#000", date: "2026-01-01", order: 0, createdAt: T(50), updatedAt: T(50) }
    const col = { id: "c", name: "n", icon: "star", items: [], order: 3, createdAt: T(50), updatedAt: T(50) }
    const d = { ...emptyJournalData(), habits: [habit], collections: [col] }
    const out = journalDataSchema.parse(JSON.parse(JSON.stringify(d)))
    assert.equal(out.habits[0].date, "2026-01-01")
    assert.equal(out.collections[0].order, 3)
  }],
  ["schema rejects malformed timestamps", () => {
    const bad = { ...withEntries([entry("a", "x", 5, { updatedAt: "zzz" })]) }
    assert.equal(journalDataSchema.safeParse(bad).success, false)
  }],
]
let fail = 0
for (const [name, fn] of checks) {
  try { fn(); console.log(`PASS ${name}`) } catch (e) { fail++; console.log(`FAIL ${name}: ${(e as Error).message.split("\n")[0]}`) }
}
process.exit(fail ? 1 : 0)
