import { useSyncExternalStore } from "react"

export type View = "daily" | "weekly" | "monthly" | "habits" | "collections"
export type Route = { view: View; date?: string; collectionId?: string }

// Hash routing: one static page, route lives after `#`. Works with refresh and
// Capacitor (no host rewrites needed).
export const routes = {
  daily: (date?: string) => (date ? `/daily/${date}` : "/daily"),
  weekly: () => "/weekly",
  monthly: () => "/monthly",
  habits: () => "/habits",
  collections: () => "/collections",
  collection: (id: string) => `/collections/${encodeURIComponent(id)}`,
}

export function parseRoute(path: string): Route {
  const [seg, arg] = path.replace(/^#?\/?/, "").split("/")
  if (seg === "weekly" || seg === "monthly" || seg === "habits") return { view: seg }
  if (seg === "collections") return { view: seg, collectionId: arg ? decodeURIComponent(arg) : undefined }
  return { view: "daily", date: arg }
}

export function navigate(path: string, opts?: { replace?: boolean }) {
  if (opts?.replace) window.location.replace(`#${path}`)
  else window.location.hash = path
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb)
  return () => window.removeEventListener("hashchange", cb)
}

const hashSnapshot = () => window.location.hash

// Subscribes to the raw hash string (stable primitive), parsed on render.
export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, hashSnapshot, () => ""))
}
