# Sub-project 1: Retry with Exponential Backoff + Error Categorization

**Part of:** Google Drive Sync Reliability (4 sub-projects)
**Dependencies:** None (this is the foundation)
**Depended on by:** Sub-projects 2 (notifications), 3 (offline queue), 4 (version history)

## Problem

The current Drive sync has fragile error handling:
- Only retries on 401 (token expired), using a manual inline check
- No retry for transient failures (network drops, server errors, rate limits)
- No structured error types — callers can't distinguish "needs re-sign-in" from "try again in a moment"
- A single network hiccup during auto-sync silently drops the user's changes

## Goal

Replace the ad-hoc error handling in `drive.ts` with a `withRetry` wrapper that:
1. Classifies errors into typed categories
2. Retries transient failures with exponential backoff
3. Handles 401 token refresh as a special case
4. Exports `SyncError` and `SyncErrorType` for downstream sub-projects to consume

## Error Classification

```typescript
export enum SyncErrorType {
  NETWORK = "NETWORK",             // fetch threw (no response at all)
  SERVER_ERROR = "SERVER_ERROR",   // HTTP 500-599
  RATE_LIMITED = "RATE_LIMITED",   // HTTP 429
  AUTH_EXPIRED = "AUTH_EXPIRED",   // HTTP 401 after refresh attempt
  FORBIDDEN = "FORBIDDEN",        // HTTP 403
  CLIENT_ERROR = "CLIENT_ERROR",  // HTTP 400, 404, other 4xx
}

export class SyncError extends Error {
  type: SyncErrorType
  status?: number

  constructor(type: SyncErrorType, message: string, status?: number) {
    super(message)
    this.name = "SyncError"
    this.type = type
    this.status = status
  }
}
```

### Classification Rules

| Condition | SyncErrorType | Retryable |
|---|---|---|
| `fetch` throws (TypeError, network error) | `NETWORK` | Yes |
| HTTP 429 | `RATE_LIMITED` | Yes |
| HTTP 500-599 | `SERVER_ERROR` | Yes |
| HTTP 401 (after token refresh attempt) | `AUTH_EXPIRED` | No |
| HTTP 403 | `FORBIDDEN` | No |
| HTTP 400, 404, other 4xx | `CLIENT_ERROR` | No |

### Helper

```typescript
function classifyResponse(response: Response): SyncError | null {
  if (response.ok) return null

  const status = response.status
  if (status === 429) return new SyncError(SyncErrorType.RATE_LIMITED, "Rate limited", status)
  if (status >= 500) return new SyncError(SyncErrorType.SERVER_ERROR, `Server error ${status}`, status)
  if (status === 401) return new SyncError(SyncErrorType.AUTH_EXPIRED, "Token expired", status)
  if (status === 403) return new SyncError(SyncErrorType.FORBIDDEN, "Forbidden", status)
  return new SyncError(SyncErrorType.CLIENT_ERROR, `Client error ${status}`, status)
}
```

## Retry Logic: `withRetry`

```typescript
interface RetryOptions {
  maxRetries?: number    // default: 3
  baseDelayMs?: number   // default: 2000
  maxDelayMs?: number    // default: 10000
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T>
```

### Behavior

1. Call `fn()` — each `fn` internally calls `classifyResponse()` on the fetch result and throws `SyncError` on non-ok responses
2. On success: return result
3. `withRetry` catches `SyncError` and decides based on `.type`:
   - **If retryable** (`NETWORK`, `SERVER_ERROR`, `RATE_LIMITED`):
     - Wait `baseDelay * 2^attempt` ms (with ±25% jitter, capped at `maxDelayMs`)
     - Retry up to `maxRetries` times
     - After all retries exhausted: throw the last `SyncError`
   - **If 401 (first occurrence only)**:
     - Call `refreshAccessToken()` (does not consume a retry)
     - Retry the original `fn()` once
     - If 401 again: throw `SyncError(AUTH_EXPIRED)`
   - **If non-retryable** (`FORBIDDEN`, `CLIENT_ERROR`): throw immediately

### Backoff Schedule (defaults)

| Attempt | Base Delay | With Jitter Range |
|---|---|---|
| Retry 1 | 2s | 1.5s – 2.5s |
| Retry 2 | 4s | 3.0s – 5.0s |
| Retry 3 | 8s | 6.0s – 10.0s |

Total worst-case wait: ~17.5s before final failure.

### Jitter Formula

```typescript
const delay = Math.min(baseDelay * 2 ** attempt, maxDelay)
const jitter = delay * (0.75 + Math.random() * 0.5) // ±25%
await new Promise(resolve => setTimeout(resolve, jitter))
```

## Refactored Drive Functions

### `uploadToDrive(data: string)`

**Before:** Inline try/catch checking `error.message.includes('401')`, single manual retry.
**After:** Wraps the actual upload fetch call in `withRetry`. The function body handles Drive API semantics (find file → update or create), while `withRetry` handles transient error recovery.

```
uploadToDrive(data)
  → findBackupFile(token)         // wrapped in withRetry
  → updateFile(token, id, data)   // wrapped in withRetry
  or createFile(token, data)      // wrapped in withRetry
```

Each internal fetch-based operation gets `withRetry` individually, so a transient failure finding the file doesn't prevent the upload from retrying.

### `downloadFromDrive()`

**Before:** Same inline 401 check.
**After:** Wraps the fetch calls in `withRetry`.

```
downloadFromDrive()
  → findBackupFile(token)         // wrapped in withRetry
  → fetch file content            // wrapped in withRetry
```

### `getLastSyncTime()`

Wrap in `withRetry` for consistency.

## File Modified

**`lib/google/drive.ts`** — all changes contained here:

1. Add `SyncErrorType` enum and `SyncError` class (exported)
2. Add `classifyResponse()` helper (internal)
3. Add `withRetry()` helper (internal)
4. Refactor `uploadToDrive()` — replace inline 401 logic with `withRetry`
5. Refactor `downloadFromDrive()` — same
6. Refactor `getLastSyncTime()` — same
7. Remove the existing manual 401-retry code blocks

## What This Enables for Later Sub-projects

- **Sub-project 2 (Notifications):** `auto-sync.ts` can catch `SyncError` and show targeted messages based on `.type` (e.g., "Please sign in again" for `AUTH_EXPIRED`, "Network issue" for `NETWORK`)
- **Sub-project 3 (Offline Queue):** Queue processor can use `SyncErrorType` to decide whether to re-queue (transient) or drop (permanent failure)
- **Sub-project 4 (Version History):** New Drive API calls for revisions can reuse `withRetry` and `classifyResponse`

## Verification

1. **Normal sync:** Make an edit → auto-sync should succeed as before
2. **Token expiry simulation:** Manually clear the persisted token → next sync should refresh and succeed (no user-visible error)
3. **TypeScript:** `npx tsc --noEmit` passes
4. **Error type check:** In browser DevTools, confirm `SyncError` instances have correct `.type` values by temporarily forcing an error
