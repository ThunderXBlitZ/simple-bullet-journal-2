"use client"

import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { MonthlyView } from "@/components/journal/monthly-view"
import { routes } from "@/lib/routes"

export default function MonthlyPage() {
  const router = useRouter()
  return <MonthlyView onDateClick={(d) => router.push(routes.daily(format(d, "yyyy-MM-dd")))} />
}
