export type View = "daily" | "weekly" | "monthly" | "habits" | "collections"

export const routes = {
  daily: (date?: string) => (date ? `/daily/?date=${date}` : "/daily/"),
  weekly: () => "/weekly/",
  monthly: () => "/monthly/",
  habits: () => "/habits/",
  collections: () => "/collections/",
  collection: (id: string) => `/collections/view/?id=${encodeURIComponent(id)}`,
}

export function viewFromPath(pathname: string): View {
  const seg = pathname.split("/")[1]
  return seg === "weekly" || seg === "monthly" || seg === "habits" || seg === "collections" ? seg : "daily"
}
