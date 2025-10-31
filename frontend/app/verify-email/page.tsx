"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * Index route for /verify-email that normalizes the token URL:
 * - If ?token exists, redirects to /verify-email/[token]
 * - Otherwise, redirects to /login
 */
function VerifyEmailHandler() {
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

export default function VerifyEmailIndexPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailHandler />
    </Suspense>
  )
}