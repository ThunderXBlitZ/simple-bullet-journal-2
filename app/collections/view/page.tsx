"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CollectionDetail } from "@/components/journal/collection-detail"
import { useJournalStore } from "@/lib/journal-store"
import { routes } from "@/lib/routes"

export default function CollectionPage() {
  const router = useRouter()
  const id = useSearchParams().get("id")
  const exists = useJournalStore((s) => s.collections.some((c) => c.id === id))
  useEffect(() => {
    if (!exists) router.replace(routes.collections())
  }, [exists, router])
  if (!id || !exists) return null
  return <CollectionDetail collectionId={id} onBack={() => router.back()} />
}
