"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function ResetPasswordIndexPage() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get("token")
    if (token) {
      router.replace(`/reset-password/${encodeURIComponent(token)}`)
    } else {
      // No token in query → send user to the email entry page
      router.replace("/forgot-password")
    }
  }, [params, router])

  return null
}