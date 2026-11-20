export interface AuthUser {
  id: string
  email: string
  name: string
}

/** Swappable per platform (web GIS now; native plugin under Capacitor later). */
export interface AuthProvider {
  /** Load SDK; safe to call repeatedly. */
  init(): Promise<void>
  /** Interactive sign-in (needs a user gesture). Pass `hint` (email) to pre-select an account. */
  signIn(hint?: string): Promise<AuthUser>
  /** Background token refresh, no UI. If `accountId` is given, a token for a different account is rejected. */
  silentRefresh(opts?: { hint?: string; accountId?: string }): Promise<boolean>
  /** Current token, or null if absent/expired. */
  getToken(): string | null
  signOut(): void
}
