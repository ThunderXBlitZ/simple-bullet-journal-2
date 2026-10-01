/**
 * Google Sign-In Integration
 * Uses Google Identity Services library for OAuth2 authentication
 */

import { persistGoogleToken, getPersistedGoogleToken, clearPersistedGoogleToken } from '../storage/zustand-adapter'

interface GoogleUser {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

interface GoogleAuthConfig {
  clientId: string;
  scope: string[];
}

let tokenClient: any = null;
let currentAccessToken: string | null = null;

/**
 * Initialize Google Sign-In
 * Call this once on app load
 */
export async function initializeGoogle(config: GoogleAuthConfig): Promise<void> {
  return new Promise((resolve) => {
    // Load Google Identity Services library
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) {
        // Initialize token client with an empty callback — the real callback
        // is set dynamically per-request in signInWithGoogle()
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: config.clientId,
          scope: config.scope.join(' '),
          callback: '',
        });
        resolve();
      }
    };
    document.head.appendChild(script);
  });
}

/**
 * Sign in with Google and get access token for Drive API
 * Opens OAuth consent screen
 */
export async function signInWithGoogle(): Promise<GoogleUser> {
  if (!tokenClient) {
    throw new Error('Google not initialized');
  }

  return new Promise((resolve, reject) => {
    // Set callback dynamically so it resolves THIS promise when OAuth completes
    tokenClient.callback = async (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      if (response.access_token) {
        currentAccessToken = response.access_token;
        const expiryMs = Date.now() + (response.expires_in ?? 3585) * 1000
        persistGoogleToken(response.access_token, expiryMs)
        try {
          const user = await fetchUserInfo();
          resolve(user);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('No access token received'));
      }
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Sign out from Google
 */
export function signOutFromGoogle(): void {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  currentAccessToken = null;
  tokenClient = null;
}

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  return currentAccessToken;
}

/**
 * Set access token (e.g., when loading from storage)
 */
export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

/**
 * Restore persisted token on app startup
 * - If non-expired token exists: restore it
 * - If expired: attempt silent refresh
 * - If no token: no-op
 */
export async function restorePersistedToken(): Promise<void> {
  const stored = await getPersistedGoogleToken();
  if (!stored) return;

  const BUFFER_MS = 60_000; // consider expired 60s early
  if (Date.now() < stored.expiryMs - BUFFER_MS) {
    // Token is still valid
    currentAccessToken = stored.token;
  } else if (tokenClient) {
    // Token is expired — attempt silent re-auth
    try {
      await refreshAccessToken();
    } catch {
      // Silent refresh failed — leave token null
      clearPersistedGoogleToken();
    }
  }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<string> {
  if (!tokenClient) {
    throw new Error('Google not initialized');
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      if (!response.access_token) {
        reject(new Error('No access token received'));
        return;
      }
      currentAccessToken = response.access_token;
      const expiryMs = Date.now() + (response.expires_in ?? 3585) * 1000;
      persistGoogleToken(response.access_token, expiryMs);
      resolve(response.access_token);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Parse ID token to get user info
 * In a real app, you'd verify the signature server-side
 */
async function parseIdToken(): Promise<GoogleUser> {
  // For this demo, we'll construct user info from the access token response
  // In production, you should decode the ID token JWT

  // Fallback: fetch user info from Google API
  return fetchUserInfo();
}

/**
 * Fetch user info from Google API using access token
 */
async function fetchUserInfo(): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${currentAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = await response.json();

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    given_name: data.given_name || data.name.split(' ')[0],
    family_name: data.family_name || '',
    picture: data.picture,
  };
}

// Extend window type for Google API
declare global {
  interface Window {
    google?: {
      accounts: {
        id: any;
        oauth2: {
          initTokenClient: (config: any) => any;
        };
      };
    };
  }
}
