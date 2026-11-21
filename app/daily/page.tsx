"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { format, isValid, parseISO } from "date-fns"
import { DailyLog } from "@/components/journal/daily-log"
import { routes } from "@/lib/routes"

export default function DailyPage() {
  const router = useRouter()
  const param = useSearchParams().get("date")
  const parsed = param ? parseISO(param) : null
  const date = parsed && isValid(parsed) ? parsed : new Date()
  return <DailyLog date={date} onDateChange={(d) => router.push(routes.daily(format(d, "yyyy-MM-dd")))} />
}
