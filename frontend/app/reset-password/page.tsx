"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * Index route for /reset-password that normalizes the token URL:
 * - If ?token exists, redirects to /reset-password/[token]
 * - Otherwise, redirects to /forgot-password
 */
function ResetPasswordHandler() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = params.get("token")
    if (token) {
      router.replace(`/reset-password/${encodeURIComponent(token)}`)
    } else {
      router.replace("/forgot-password")
    }
  }, [params, router])

  return null
}

export default function ResetPasswordIndexPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordHandler />
    </Suspense>
  )
}