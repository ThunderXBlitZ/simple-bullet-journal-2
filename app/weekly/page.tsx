"use client"

import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { WeeklyView } from "@/components/journal/weekly-view"
import { routes } from "@/lib/routes"

export default function WeeklyPage() {
  const router = useRouter()
  return <WeeklyView onDateClick={(d) => router.push(routes.daily(format(d, "yyyy-MM-dd")))} />
}
