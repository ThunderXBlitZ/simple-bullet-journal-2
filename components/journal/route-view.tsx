"use client"

import { useEffect } from "react"
import { format, isValid, parseISO } from "date-fns"
import { DailyLog } from "@/components/journal/daily-log"
import { WeeklyView } from "@/components/journal/weekly-view"
import { MonthlyView } from "@/components/journal/monthly-view"
import { HabitTracker } from "@/components/journal/habit-tracker"
import { CollectionsView } from "@/components/journal/collections-view"
import { CollectionDetail } from "@/components/journal/collection-detail"
import { useJournalStore } from "@/lib/journal-store"
import { navigate, routes, type Route } from "@/lib/routes"

const openDay = (d: Date) => navigate(routes.daily(format(d, "yyyy-MM-dd")))

function DailyRoute({ date }: { date?: string }) {
  const parsed = date ? parseISO(date) : null
  return <DailyLog date={parsed && isValid(parsed) ? parsed : new Date()} onDateChange={openDay} />
}

function CollectionRoute({ id }: { id: string }) {
  const exists = useJournalStore((s) => s.collections.some((c) => c.id === id))
  useEffect(() => {
    if (!exists) navigate(routes.collections(), { replace: true })
  }, [exists])
  return exists ? <CollectionDetail collectionId={id} onBack={() => navigate(routes.collections())} /> : null
}

export function RouteView({ route }: { route: Route }) {
  switch (route.view) {
    case "weekly":
      return <WeeklyView onDateClick={openDay} />
    case "monthly":
      return <MonthlyView onDateClick={openDay} />
    case "habits":
      return <HabitTracker />
    case "collections":
      return route.collectionId ? <CollectionRoute id={route.collectionId} /> : <CollectionsView />
    default:
      return <DailyRoute date={route.date} />
  }
}
