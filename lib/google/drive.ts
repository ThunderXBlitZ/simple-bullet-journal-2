/**
 * Google Drive Sync Module
 * Handles uploading/downloading data to/from Google Drive appDataFolder
 */

import { getAccessToken, refreshAccessToken } from './auth';

const MIME_TYPE = 'application/json';
const FILE_NAME = 'bullet-journal-backup.json';
const FOLDER_NAME = 'appDataFolder';

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

/**
 * Upload data to Google Drive appDataFolder
 */
export async function uploadToDrive(data: string): Promise<void> {
  let token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    // First, try to find existing file
    const existingFileId = await findBackupFile(token);

    if (existingFileId) {
      // Update existing file
      await updateFile(existingFileId, data, token);
    } else {
      // Create new file
      await createFile(data, token);
    }
  } catch (error) {
    // If token expired, refresh and retry once
    if (error instanceof Error && error.message.includes('401')) {
      token = await refreshAccessToken();
      const existingFileId = await findBackupFile(token);

      if (existingFileId) {
        await updateFile(existingFileId, data, token);
      } else {
        await createFile(data, token);
      }
    } else {
      throw error;
    }
  }
}

/**
 * Download data from Google Drive appDataFolder
 */
export async function downloadFromDrive(): Promise<string | null> {
  let token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const fileId = await findBackupFile(token);
    if (!fileId) {
      return null; // No backup exists yet
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    // If token expired, refresh and retry once
    if (error instanceof Error && error.message.includes('401')) {
      token = await refreshAccessToken();
      const fileId = await findBackupFile(token);
      if (!fileId) {
        return null;
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      return await response.text();
    } else {
      throw error;
    }
  }
}

/**
 * Find backup file in appDataFolder
 */
async function findBackupFile(token: string): Promise<string | null> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${FILE_NAME}'&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search files: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files?.[0]?.id || null;
}

/**
 * Create new backup file in appDataFolder
 */
async function createFile(data: string, token: string): Promise<void> {
  const metadata = {
    name: FILE_NAME,
    mimeType: MIME_TYPE,
    parents: [FOLDER_NAME],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([data], { type: MIME_TYPE }));

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create file: ${response.statusText}`);
  }
}

/**
 * Update existing backup file in appDataFolder
 */
async function updateFile(fileId: string, data: string, token: string): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': MIME_TYPE,
      },
      body: data,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update file: ${response.statusText}`);
  }
}

/**
 * Get last sync timestamp from Drive file metadata
 */
export async function getLastSyncTime(): Promise<Date | null> {
  let token = getAccessToken();
  if (!token) {
    return null;
  }

  try {
    const fileId = await findBackupFile(token);
    if (!fileId) {
      return null;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.modifiedTime ? new Date(data.modifiedTime) : null;
  } catch {
    return null;
  }
}
