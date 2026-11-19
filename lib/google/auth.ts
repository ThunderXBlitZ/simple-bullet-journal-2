/** Google Identity Services (token model) implementation of AuthProvider. */

import { persistGoogleToken, getPersistedGoogleToken, clearPersistedGoogleToken } from "../storage/zustand-adapter"
import type { AuthProvider, AuthUser } from "../auth/types"
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from "./config"

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string; hint?: string }) => void
}

const EXPIRY_BUFFER_MS = 60_000

let tokenClient: TokenClient | null = null
let initPromise: Promise<void> | null = null
let accessToken: string | null = null
let expiryMs = 0
let pending: { resolve: (r: TokenResponse) => void; reject: (e: Error) => void } | null = null
let lastAccount: { id?: string; email?: string } = {}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement("script")
    s.src = "https://accounts.google.com/gsi/client"
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Couldn't load Google sign-in (offline or blocked)"))
    document.head.appendChild(s)
  })
}

function init(): Promise<void> {
  initPromise ??= loadScript()
    .then(() => {
      tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES.join(" "),
        callback: (r: TokenResponse) => {
          const p = pending
          pending = null
          if (!p) return
          if (r.error) p.reject(new Error(r.error))
          else p.resolve(r)
        },
        error_callback: (e: { type: string }) => {
          const p = pending
          pending = null
          p?.reject(new Error(e.type)) // popup_closed, popup_failed_to_open, …
        },
      })
    })
    .catch((e) => {
      initPromise = null
      throw e
    })
  return initPromise
}

async function requestToken(opts: { prompt: string; hint?: string }): Promise<void> {
  await init()
  if (pending) throw new Error("Sign-in already in progress")
  const response = await new Promise<TokenResponse>((resolve, reject) => {
    pending = { resolve, reject }
    tokenClient!.requestAccessToken(opts)
  })
  if (!response.access_token) throw new Error("No access token received")
  if (!window.google!.accounts.oauth2.hasGrantedAllScopes(response, ...GOOGLE_SCOPES)) {
    throw new Error("Google Drive access wasn't granted. Sign in again and tick the Drive permission.")
  }
  accessToken = response.access_token
  expiryMs = Date.now() + (response.expires_in ?? 3600) * 1000
  persistGoogleToken(accessToken, expiryMs)
}

async function fetchUserInfo(): Promise<AuthUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error("Failed to fetch Google account info")
  const d = await res.json()
  return { id: d.id, email: d.email, name: d.name ?? d.email }
}

function clearToken(): void {
  accessToken = null
  expiryMs = 0
  clearPersistedGoogleToken()
}

export const googleAuth: AuthProvider = {
  init,

  async signIn(hint) {
    await requestToken({ prompt: hint ? "" : "select_account", hint })
    const user = await fetchUserInfo()
    lastAccount = { id: user.id, email: user.email }
    return user
  },

  async silentRefresh(opts) {
    const hint = opts?.hint ?? lastAccount.email
    const accountId = opts?.accountId ?? lastAccount.id
    try {
      await requestToken({ prompt: "none", hint })
      if (accountId && (await fetchUserInfo()).id !== accountId) {
        clearToken()
        return false
      }
      lastAccount = { id: accountId, email: hint }
      return true
    } catch {
      return false
    }
  },

  async restore() {
    const stored = await getPersistedGoogleToken()
    if (stored && Date.now() < stored.expiryMs - EXPIRY_BUFFER_MS) {
      accessToken = stored.token
      expiryMs = stored.expiryMs
    }
  },

  getToken: () => (accessToken && Date.now() < expiryMs - EXPIRY_BUFFER_MS ? accessToken : null),

  signOut() {
    if (accessToken) window.google?.accounts.oauth2.revoke(accessToken, () => {})
    clearToken()
  },
}

/** Used by drive.ts (401 retry path). */
export const getAccessToken = (): string | null => googleAuth.getToken()

export async function refreshAccessToken(): Promise<string> {
  if (!(await googleAuth.silentRefresh())) throw new Error("Token refresh failed")
  return accessToken!
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: unknown) => TokenClient
          hasGrantedAllScopes: (response: TokenResponse, ...scopes: string[]) => boolean
          revoke: (token: string, done: () => void) => void
        }
      }
    }
  }
}
