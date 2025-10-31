"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { authStore } from "@/store/auth"
import api from "@/lib/api"
import { toast } from "sonner"

type ErrorLike = { response?: { data?: { message?: string } } }
function getMessage(err: unknown, fallback: string) {
  return (err as ErrorLike)?.response?.data?.message ?? fallback
}

export default function OAuthSuccessPage() {
  const params = useSearchParams()
  const router = useRouter()
  const setTokens = authStore((s) => s.setTokens)
  const setUser = authStore((s) => s.setUser)

  React.useEffect(() => {
    const token = params.get("token")
    if (!token) {
      toast.error("OAuth token missing")
      router.replace("/login")
      return
    }

    async function run(t: string) {
      try {
        setTokens({ access_token: t }, true)
        const me = await api.get("/users/me")
        setUser(me.data?.data)
        router.replace("/calendar")
      } catch (e: unknown) {
        toast.error(getMessage(e, "OAuth handling failed"))
        router.replace("/login")
      }
    }

    run(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}