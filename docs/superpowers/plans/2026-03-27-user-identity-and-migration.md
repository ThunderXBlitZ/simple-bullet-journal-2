# User Identity Persistence & Guest→Google Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each guest a permanent local identity so re-logins restore their data, and let guests seamlessly migrate their data when upgrading to a Google account.

**Architecture:** We add a second localStorage key (`"bj-guest-id"`) that persists the guest's UUID independently of the active session key (`"bj-active-user-key"`). On startup, if no active key is found we fall back to the persisted guestId. When a guest signs into Google via Settings, the in-memory guest state is already loaded — we switch the active key to the Google namespace and let the existing conflict-resolution UI handle any Drive data, then clear the guestId.

**Tech Stack:** Next.js App Router, Zustand + persist middleware, IndexedDB/localStorage via custom StorageProvider, Google Identity Services OAuth2.

---

## File Map

| File | Change |
|------|--------|
| `lib/storage/zustand-adapter.ts` | Add 3 helpers: `persistGuestId`, `getPersistedGuestId`, `clearPersistedGuestId` |
| `app/page.tsx` | Update `initializeApp` to fall back to guestId; update `handleSetupComplete` to persist guestId |
| `components/journal/settings-modal.tsx` | Update `handleSignInGoogle` to clear guestId on migration; update `handleLogout` |

---

## How the Keys Work (Reference)

```
localStorage["bj-active-user-key"]  → current session key (cleared on logout)
localStorage["bj-guest-id"]         → permanent guest UUID (persists across logouts)
IndexedDB["bj-guest-{uuid}"]        → guest's journal data
IndexedDB["bj-google-{googleId}"]   → Google user's journal data
```

**Startup decision tree:**
```
getPersistedActiveKey()
  → found  → setActiveStorageKey(key) → rehydrate → done
  → null   → getPersistedGuestId()
               → found  → setActiveStorageKey("bj-guest-{id}") → rehydrate → done
               → null   → rehydrate (empty) → show SetupModal
```

**Guest→Google migration decision tree (inside handleSignInGoogle):**
```
user signs in with Google
  → setActiveStorageKey("bj-google-{googleId}")   ← in-memory state still = guest data
  → checkForConflicts()
      → no Drive data    → setGoogleUser() writes guest data to Google key → clearPersistedGuestId()
      → Drive has data   → show SyncConflictModal → on resolve: setGoogleUser() → clearPersistedGuestId()
```

---

## Task 1: Add Guest ID Persistence Helpers

**Files:**
- Modify: `lib/storage/zustand-adapter.ts`

- [ ] **Step 1: Add the three helpers below `clearActiveStorageKey`**

Open `lib/storage/zustand-adapter.ts` and add after the `clearActiveStorageKey` function (after line ~35):

```typescript
/**
 * Permanently save the guest's UUID so they can restore their account after logout.
 * Unlike the active-user-key, this is NOT cleared on logout.
 */
export function persistGuestId(id: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("bj-guest-id", id)
  }
}

/**
 * Read the persisted guest UUID. Returns null if user has never been a guest
 * or has migrated to Google (clearPersistedGuestId was called).
 */
export function getPersistedGuestId(): string | null {
  if (typeof localStorage === "undefined") return null
  return localStorage.getItem("bj-guest-id")
}

/**
 * Clear the persisted guest UUID. Call this when a guest migrates to Google
 * so they no longer fall back to the guest account on startup.
 */
export function clearPersistedGuestId(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("bj-guest-id")
  }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/gjiawei/Desktop/personal/bullet-journal-2
npm run build 2>&1 | grep -E "(✓ Compiled|Type error|Failed)"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add lib/storage/zustand-adapter.ts
git commit -m "feat: add persistent guest ID helpers to storage adapter"
```

---

## Task 2: Update App Startup to Restore Returning Guests

**Files:**
- Modify: `app/page.tsx`

The current `initializeApp` only checks `getPersistedActiveKey()`. If that's null (user logged out) it falls through and shows SetupModal even for returning guests. We add the guestId fallback.

- [ ] **Step 1: Add `getPersistedGuestId` and `persistGuestId` to the import**

Find the import on line ~18:
```typescript
import { setActiveStorageKey, clearActiveStorageKey, getPersistedActiveKey } from "@/lib/storage/zustand-adapter"
```

Replace with:
```typescript
import {
  setActiveStorageKey,
  clearActiveStorageKey,
  getPersistedActiveKey,
  persistGuestId,
  getPersistedGuestId,
} from "@/lib/storage/zustand-adapter"
```

- [ ] **Step 2: Update `initializeApp` to fall back to persisted guestId**

Find `initializeApp` inside the first `useEffect` (around line 35):

```typescript
    const initializeApp = async () => {
      // Restore active storage key if user previously logged in
      const savedKey = getPersistedActiveKey()
      if (savedKey) {
        setActiveStorageKey(savedKey)
      }

      await useJournalStore.persist.rehydrate()
      setMounted(true)
    }
```

Replace with:

```typescript
    const initializeApp = async () => {
      // Priority 1: restore the active session key (set on login, cleared on logout)
      const savedKey = getPersistedActiveKey()
      if (savedKey) {
        setActiveStorageKey(savedKey)
      } else {
        // Priority 2: returning guest — they logged out but their identity persists
        const savedGuestId = getPersistedGuestId()
        if (savedGuestId) {
          const guestKey = `bj-guest-${savedGuestId}`
          setActiveStorageKey(guestKey)
        }
        // If neither exists: first-time user — rehydrate gets empty state, SetupModal shows
      }

      await useJournalStore.persist.rehydrate()
      setMounted(true)
    }
```

- [ ] **Step 3: Update `handleSetupComplete` to persist the guestId on first guest login**

Find `handleSetupComplete` (around line 95):

```typescript
  const handleSetupComplete = (authMethod: "guest" | "google", name: string, googleData?: any) => {
    if (authMethod === "google" && googleData) {
      // Set storage key BEFORE store writes for Google users
      setActiveStorageKey(`bj-google-${googleData.id}`)
      // Store Google auth info
      setGoogleUser(googleData.id, googleData.email, "", "")
    } else {
      // Guest mode - set storage key BEFORE store writes
      const guestId = generateGuestId()
      setActiveStorageKey(`bj-guest-${guestId}`)
      useJournalStore.setState({ guestId })
      setAuthMethod("guest")
    }

    setUserName(name)
  }
```

Replace with:

```typescript
  const handleSetupComplete = (authMethod: "guest" | "google", name: string, googleData?: any) => {
    if (authMethod === "google" && googleData) {
      // Set storage key BEFORE store writes for Google users
      setActiveStorageKey(`bj-google-${googleData.id}`)
      setGoogleUser(googleData.id, googleData.email, "", "")
    } else {
      // Guest mode: use persisted ID if this is a returning guest,
      // otherwise generate a fresh one
      const existingGuestId = getPersistedGuestId()
      const guestId = existingGuestId ?? generateGuestId()
      setActiveStorageKey(`bj-guest-${guestId}`)
      persistGuestId(guestId)                    // survives future logouts
      useJournalStore.setState({ guestId })
      setAuthMethod("guest")
    }

    setUserName(name)
  }
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "(✓ Compiled|Type error|Failed)"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: restore returning guest data on startup using persistent guest ID"
```

---

## Task 3: Guest→Google Migration in Settings Modal

**Files:**
- Modify: `components/journal/settings-modal.tsx`

When a guest signs into Google from Settings, their journal data is already in the Zustand store in memory. We switch the storage key to the Google namespace — the next store write will land under the Google key, effectively migrating the data. After successful migration we clear the guestId so they no longer fall back to the guest account.

- [ ] **Step 1: Import the new helpers**

Find the import line (around line 13):
```typescript
import { setActiveStorageKey, clearActiveStorageKey } from "@/lib/storage/zustand-adapter"
```

Replace with:
```typescript
import { setActiveStorageKey, clearActiveStorageKey, clearPersistedGuestId } from "@/lib/storage/zustand-adapter"
```

- [ ] **Step 2: Update `handleSignInGoogle` to clear guestId after successful migration**

Find `handleSignInGoogle` (around line 80). The current code:

```typescript
  const handleSignInGoogle = async () => {
    if (!GOOGLE_SYNC_ENABLED || !GOOGLE_CONFIG.clientId) {
      toast.error("Google Sign-In is not configured")
      return
    }

    try {
      const user = await signInWithGoogle()
      // Set storage key BEFORE store writes
      setActiveStorageKey(`bj-google-${user.id}`)
      setGoogleUser(user.id, user.email, "", "")
      toast.success("Signed in with Google!")

      // Check for conflicts between local and Drive data
      const conflict = await checkForConflicts()

      if (conflict.hasConflict) {
        // Save current state as backup for undo
        const backup = createStateBackup()
        setPreSignInBackup(backup)
        setLocalSummary(conflict.localSummary)
        setDriveSummary(conflict.driveSummary)
        setShowConflictModal(true)
      } else if (conflict.driveSummary?.hasData) {
        // No conflict but Drive has data - default to keep-both
        await handleMergeStrategy("keep-both")
      }
      // else: No data on Drive, local data will sync automatically via auto-sync
    } catch (error) {
      console.error("Google sign-in failed:", error)
      toast.error("Failed to sign in with Google")
    }
  }
```

Replace with:

```typescript
  const handleSignInGoogle = async () => {
    if (!GOOGLE_SYNC_ENABLED || !GOOGLE_CONFIG.clientId) {
      toast.error("Google Sign-In is not configured")
      return
    }

    try {
      const user = await signInWithGoogle()

      // Switch storage key to Google namespace BEFORE any store writes.
      // The in-memory store still holds the guest's data — this is intentional.
      // The first write after this point migrates guest data to the Google key.
      setActiveStorageKey(`bj-google-${user.id}`)
      setGoogleUser(user.id, user.email, "", "")
      toast.success("Signed in with Google!")

      // Check for conflicts between guest (local) data and Drive data
      const conflict = await checkForConflicts()

      if (conflict.hasConflict) {
        // Both sides have data — let user decide
        const backup = createStateBackup()
        setPreSignInBackup(backup)
        setLocalSummary(conflict.localSummary)
        setDriveSummary(conflict.driveSummary)
        setShowConflictModal(true)
        // clearPersistedGuestId() called in handleMergeStrategy after resolution
      } else if (conflict.driveSummary?.hasData) {
        // Drive has data, local (guest) doesn't — pull Drive data
        await handleMergeStrategy("keep-both")
        // clearPersistedGuestId() called inside handleMergeStrategy
      } else {
        // Drive is empty — guest data migrates automatically via auto-sync.
        // Migration is complete; sever the guest identity link.
        clearPersistedGuestId()
      }
    } catch (error) {
      console.error("Google sign-in failed:", error)
      toast.error("Failed to sign in with Google")
    }
  }
```

- [ ] **Step 3: Update `handleMergeStrategy` to clear guestId after conflict resolution**

Find `handleMergeStrategy` (around line 115):

```typescript
  const handleMergeStrategy = async (strategy: MergeStrategy) => {
    setShowConflictModal(false)
    setIsSyncing(true)

    try {
      // Create backup before merging (for undo)
      const premergeBackup = createStateBackup()

      // Apply the merge strategy
      await applyMergeStrategy(strategy)

      // Show undo toast for 10 seconds
      setShowUndoToast(true)
      const timeout = setTimeout(() => {
        setShowUndoToast(false)
      }, 10000)
      setUndoTimeout(timeout)

      // Store pre-merge backup for undo
      setPreSignInBackup(premergeBackup)

      toast.success(`Data merged using "${strategy}" strategy`)
    } catch (error) {
      console.error("Merge failed:", error)
      toast.error("Failed to merge data")
    } finally {
      setIsSyncing(false)
    }
  }
```

Replace with:

```typescript
  const handleMergeStrategy = async (strategy: MergeStrategy) => {
    setShowConflictModal(false)
    setIsSyncing(true)

    try {
      // Create backup before merging (for undo)
      const premergeBackup = createStateBackup()

      // Apply the merge strategy
      await applyMergeStrategy(strategy)

      // Migration complete — guest identity no longer needed
      clearPersistedGuestId()

      // Show undo toast for 10 seconds
      setShowUndoToast(true)
      const timeout = setTimeout(() => {
        setShowUndoToast(false)
      }, 10000)
      setUndoTimeout(timeout)

      // Store pre-merge backup for undo
      setPreSignInBackup(premergeBackup)

      toast.success(`Data merged using "${strategy}" strategy`)
    } catch (error) {
      console.error("Merge failed:", error)
      toast.error("Failed to merge data")
    } finally {
      setIsSyncing(false)
    }
  }
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "(✓ Compiled|Type error|Failed)"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add components/journal/settings-modal.tsx
git commit -m "feat: migrate guest data to Google account on sign-in, clear guest identity after migration"
```

---

## Manual Test Checklist

After all tasks are complete, verify these scenarios in the browser (clear IndexedDB between each scenario using DevTools → Application → IndexedDB → delete all):

**Scenario 1: Returning Guest**
1. Open app → SetupModal appears (no guestId in localStorage)
2. Choose Guest, enter name "Alex", submit
3. Create a journal entry "Test entry"
4. Open Settings → click Logout
5. SetupModal reappears (no journal behind it ✓)
6. Choose Guest, enter any name, submit
7. **Expected:** "Test entry" is still present ✓

**Scenario 2: Name Change Doesn't Lose Data**
1. Login as guest "Alex", add entry "My note"
2. Settings → change name to "Alex B" → Save
3. Logout → Login as guest again
4. **Expected:** "My note" still present, name is "Alex B" ✓

**Scenario 3: Guest→Google Migration (empty Drive)**
1. Login as guest "Alex", add entry "Guest entry"
2. Settings → Sign in with Google
3. **Expected:** "Guest entry" visible after Google sign-in ✓
4. Logout → Login with Google again
5. **Expected:** "Guest entry" still there ✓
6. Logout → Login as Guest
7. **Expected:** SetupModal appears (new guest account, no old data) — guestId was cleared ✓

**Scenario 4: Guest→Google Migration (Drive has data)**
1. Login as guest "Alex", add entry "Guest entry"
2. Settings → Sign in with Google (account that already has Drive data)
3. **Expected:** Conflict resolution modal appears ✓
4. Choose a strategy → confirm merge
5. **Expected:** Merged data visible ✓, guestId cleared ✓

**Scenario 5: New User After Guest Migrates**
1. Complete Scenario 3
2. Open a new incognito tab (or clear localStorage)
3. Open app → SetupModal appears ✓
4. Login as Guest → brand new empty journal ✓
