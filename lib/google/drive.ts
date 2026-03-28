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
