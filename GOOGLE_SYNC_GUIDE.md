# Google Sync Guide

## How linking works
- Settings → **Google** → **Sign in with Google**. Consent must include the Drive permission.
- First link: your local journal and the Drive file are merged per record (`id` + `updatedAt`; deletes are tombstones).
- Signing in as a **different** Google account replaces the local journal with that account's data. Your previous
  journal is downloaded as a JSON backup first. The other account's Drive file is untouched.
- **Sign out** keeps the link. Signing back in resumes sync. Reconnect is refused if you pick a different account.

## What's stored
- One file, `bullet-journal.json`, in your Drive **appDataFolder** (hidden from the normal Drive UI).
- Body: `{ app: "bullet-journal", schema: 2, updatedAt, data }`.
- The old `bullet-journal-backup.json` is read once as a legacy fallback and never modified or deleted.
- Device-local only: settings and sync status. The access token is kept in memory only and re-minted silently on load.

## Sync triggers
- 5 seconds after a journal change (debounced).
- App load (when linked) and tab refocus (throttled to 30s), plus the `online` event.
- The sync icon next to your email in Settings → Google.

## Statuses
- `Synced <time>` / `Syncing…` / `Paused — reconnect to resume.` / error message.
- A paused banner appears at the top when the token can't be refreshed silently.

## Recovery
- Settings → Export / import (JSON): the download button saves the whole journal.
- the upload button merges (max 10 MB) a backup back in (tombstones still win over older copies).
- The Drive file can be downloaded from the app folder via the Drive API if needed.

## Troubleshooting
- "Google Sign-In is not configured": `NEXT_PUBLIC_GOOGLE_CLIENT_ID` missing/empty.
- "Google Drive access wasn't granted": untick on consent → sign in again and tick Drive.
- Nothing syncs: check the status line, and the console for `googleapis` errors.
- Wrong account on reconnect: sign in as the linked email, or use Sign in to switch accounts.
