"use client"

import { useEffect } from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

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