/**
 * Google Drive Sync Module
 * Dumb transport: read/write one file in the appDataFolder with a version check.
 */

import { getAccessToken, refreshAccessToken } from "./auth"

const MIME_TYPE = "application/json"
const FILE_NAME = "bullet-journal.json"
const LEGACY_FILE_NAME = "bullet-journal-backup.json"
const FOLDER_NAME = "appDataFolder"

/**
 * Error types for sync operations
 */
export enum SyncErrorType {
  NETWORK = "NETWORK",               // fetch threw (no response at all)
  SERVER_ERROR = "SERVER_ERROR",     // HTTP 500-599
  RATE_LIMITED = "RATE_LIMITED",     // HTTP 429
  AUTH_EXPIRED = "AUTH_EXPIRED",     // HTTP 401 after refresh attempt
  FORBIDDEN = "FORBIDDEN",           // HTTP 403
  CLIENT_ERROR = "CLIENT_ERROR",     // HTTP 400, 404, other 4xx
}

/**
 * Structured error class for sync operations
 * Used by retry logic and downstream consumers (notifications, offline queue)
 */
export class SyncError extends Error {
  type: SyncErrorType
  status?: number

  constructor(type: SyncErrorType, message: string, status?: number) {
    super(message)
    this.name = "SyncError"
    this.type = type
    this.status = status
    Object.setPrototypeOf(this, SyncError.prototype)
  }
}

/**
 * Classify a fetch response into a SyncError if not ok
 * Returns null if response is ok
 */
function classifyResponse(response: Response): SyncError | null {
  if (response.ok) return null

  const status = response.status
  if (status === 429) {
    return new SyncError(SyncErrorType.RATE_LIMITED, "Rate limited by Google Drive", status)
  }
  if (status >= 500) {
    return new SyncError(SyncErrorType.SERVER_ERROR, `Server error ${status}`, status)
  }
  if (status === 401) {
    return new SyncError(SyncErrorType.AUTH_EXPIRED, "Token expired or invalid", status)
  }
  if (status === 403) {
    return new SyncError(SyncErrorType.FORBIDDEN, "Forbidden", status)
  }
  return new SyncError(SyncErrorType.CLIENT_ERROR, `Client error ${status}`, status)
}

/**
 * Retry options
 */
interface RetryOptions {
  maxRetries?: number    // default: 3
  baseDelayMs?: number   // default: 2000
  maxDelayMs?: number    // default: 10000
}

/**
 * Wraps async operations with exponential backoff retry logic
 * Retries on transient failures (NETWORK, SERVER_ERROR, RATE_LIMITED)
 * Special handling for 401: attempts refresh once, doesn't consume retry budget
 * Non-retryable errors (AUTH_EXPIRED after refresh, FORBIDDEN, CLIENT_ERROR) throw immediately
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 2000
  const maxDelayMs = options?.maxDelayMs ?? 10000

  let lastError: SyncError | null = null

  // Initial attempt
  try {
    return await fn()
  } catch (e) {
    if (!(e instanceof SyncError)) {
      // Non-SyncError (unexpected type), rethrow as NETWORK error
      throw new SyncError(SyncErrorType.NETWORK, String(e))
    }
    lastError = e
  }

  // Handle 401 specially: refresh token and retry once (doesn't consume budget)
  if (lastError.type === SyncErrorType.AUTH_EXPIRED) {
    try {
      await refreshAccessToken()
      return await fn()
    } catch (e) {
      if (e instanceof SyncError && e.type === SyncErrorType.AUTH_EXPIRED) {
        throw e // Token refresh failed or second 401
      }
      if (!(e instanceof SyncError)) {
        throw new SyncError(SyncErrorType.NETWORK, String(e))
      }
      throw e
    }
  }

  // Retry budget for transient errors
  const isRetryable = (error: SyncError): boolean =>
    error.type === SyncErrorType.NETWORK ||
    error.type === SyncErrorType.SERVER_ERROR ||
    error.type === SyncErrorType.RATE_LIMITED

  if (!isRetryable(lastError)) {
    throw lastError // Non-retryable, fail immediately
  }

  // Exponential backoff retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const baseDelay = baseDelayMs * Math.pow(2, attempt - 1)
    const delay = Math.min(baseDelay, maxDelayMs)
    // Jitter: ±25% (0.75 to 1.25 multiplier)
    const jitter = delay * (0.75 + Math.random() * 0.5)

    await new Promise((resolve) => setTimeout(resolve, jitter))

    try {
      return await fn()
    } catch (e) {
      if (!(e instanceof SyncError)) {
        lastError = new SyncError(SyncErrorType.NETWORK, String(e))
      } else {
        lastError = e
      }

      // If this attempt hit a 401, handle it
      if (lastError.type === SyncErrorType.AUTH_EXPIRED && attempt < maxRetries) {
        try {
          await refreshAccessToken()
          // Continue to next retry iteration with fresh token
          continue
        } catch {
          throw lastError
        }
      }

      // If non-retryable, fail immediately (don't burn more retries)
      if (!isRetryable(lastError)) {
        throw lastError
      }

      // Otherwise: retryable error, loop to next attempt
    }
  }

  // All retries exhausted
  throw lastError
}

export interface RemoteFile {
  text: string | null
  fileId: string | null // id of the *new-format* file (null if absent or only legacy exists)
  version: string | null
  legacy: boolean // true when text came from the legacy snapshot file
}

/** Token is read per attempt, so a refresh inside withRetry is actually used. */
function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  if (!token) throw new SyncError(SyncErrorType.AUTH_EXPIRED, "Not authenticated with Google")
  return { Authorization: `Bearer ${token}` }
}

async function findFile(name: string): Promise<{ id: string; version: string } | null> {
  const q = encodeURIComponent(`name='${name}'`)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&orderBy=createdTime&pageSize=1&fields=files(id,version)`,
    { headers: authHeaders() },
  )
  const error = classifyResponse(res)
  if (error) throw error
  const f = (await res.json()).files?.[0]
  return f ? { id: f.id, version: String(f.version) } : null
}

async function readContent(id: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: authHeaders() })
  const error = classifyResponse(res)
  if (error) throw error
  return res.text()
}

/** Reads the sync file (falls back to the legacy snapshot, read-only). Version is read *before* content. */
export async function readSyncFile(): Promise<RemoteFile> {
  return withRetry(async () => {
    const current = await findFile(FILE_NAME)
    if (current) return { text: await readContent(current.id), fileId: current.id, version: current.version, legacy: false }
    const legacy = await findFile(LEGACY_FILE_NAME)
    if (legacy) return { text: await readContent(legacy.id), fileId: null, version: null, legacy: true }
    return { text: null, fileId: null, version: null, legacy: false }
  })
}

async function createFile(text: string): Promise<void> {
  const form = new FormData()
  form.append("metadata", new Blob([JSON.stringify({ name: FILE_NAME, mimeType: MIME_TYPE, parents: [FOLDER_NAME] })], { type: "application/json" }))
  form.append("file", new Blob([text], { type: MIME_TYPE }))
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  })
  const error = classifyResponse(res)
  if (error) throw error
}

/**
 * Writes the sync file. Returns "conflict" (nothing written) if the remote changed since it was read,
 * so the caller re-pulls and re-merges. Version check is a narrow window, not a lock; merge makes it safe.
 */
export async function writeSyncFile(
  text: string,
  expect: { fileId: string | null; version: string | null },
): Promise<"ok" | "conflict"> {
  return withRetry(async () => {
    if (!expect.fileId) {
      await createFile(text)
      return "ok" as const
    }
    const meta = await fetch(`https://www.googleapis.com/drive/v3/files/${expect.fileId}?fields=version`, { headers: authHeaders() })
    if (meta.status === 404) return "conflict" as const // file vanished → re-pull will recreate
    const metaError = classifyResponse(meta)
    if (metaError) throw metaError
    if (String((await meta.json()).version) !== expect.version) return "conflict" as const

    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${expect.fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": MIME_TYPE },
      body: text,
    })
    const error = classifyResponse(res)
    if (error) throw error
    return "ok" as const
  })
}
