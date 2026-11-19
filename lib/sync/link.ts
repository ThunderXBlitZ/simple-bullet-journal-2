import { toast } from "sonner"
import { useJournalStore } from "../journal-store"
import { googleAuth } from "../google/auth"
import { downloadBackup } from "../backup"
import { syncNow } from "./engine"

/** Sign in and link/switch. First link merges (D5); a different account replaces local after a backup download (D6). */
export async function connectGoogle(): Promise<"linked" | "switched"> {
  const user = await googleAuth.signIn()
  const store = useJournalStore.getState()
  const switching = !!store.syncAccountId && store.syncAccountId !== user.id
  if (switching) {
    downloadBackup() // previous journal, as a file, before it is replaced
    store.resetJournalData()
  }
  store.setLinkedAccount(user.id, user.email)
  await syncNow()
  if (switching) toast.message("Switched account. Your previous journal was downloaded as a backup file.")
  return switching ? "switched" : "linked"
}

/** Re-auth for the already-linked account; refuses a different account (would mix journals). */
export async function reconnectGoogle(): Promise<void> {
  const { syncAccountId, googleEmail } = useJournalStore.getState()
  const user = await googleAuth.signIn(googleEmail ?? undefined)
  if (syncAccountId && user.id !== syncAccountId) {
    googleAuth.signOut()
    throw new Error(`Please sign in as ${googleEmail}, or use "Sign in with Google" to switch accounts.`)
  }
  await syncNow()
}
