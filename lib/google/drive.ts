/**
 * Google Drive Sync Module
 * Handles uploading/downloading data to/from Google Drive appDataFolder
 */

import { getAccessToken, refreshAccessToken } from './auth';

const MIME_TYPE = 'application/json';
const FILE_NAME = 'bullet-journal-backup.json';
const FOLDER_NAME = 'appDataFolder';

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
