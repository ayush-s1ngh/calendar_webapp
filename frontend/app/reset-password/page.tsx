"use client"

import { useEffect } from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

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