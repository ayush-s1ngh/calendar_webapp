"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { toast } from "sonner"

type ErrorLike = { response?: { data?: { message?: string } } }
function getMessage(err: unknown, fallback: string) {
  return (err as ErrorLike)?.response?.data?.message ?? fallback
}

export default function VerifyEmailPage({ params }: { params: { token: string } }) {
  const router = useRouter()
  React.useEffect(() => {
    async function run() {
      try {
        await api.post(`/auth/verify-email/${encodeURIComponent(params.token)}`)
        toast.success("Email successfully verified. Please login.")
        router.replace("/login")
      } catch (e: unknown) {
        toast.error(getMessage(e, "Email verification failed"))
        router.replace("/login")
      }
    }
    run()
  }, [params.token, router])

  return null
}