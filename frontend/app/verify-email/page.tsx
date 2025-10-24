"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function VerifyEmailIndexPage() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get("token")
    if (token) {
      router.replace(`/verify-email/${encodeURIComponent(token)}`)
    } else {
      router.replace("/login")
    }
  }, [params, router])

  return null
}