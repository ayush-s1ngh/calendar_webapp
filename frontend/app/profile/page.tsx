"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { authStore } from "@/store/auth"

export default function ProfilePage() {
  const router = useRouter()
  const tokens = authStore((s) => s.tokens)
  const user = authStore((s) => s.user)
  const hydrate = authStore((s) => s.hydrate)
  const hydrated = authStore((s) => s.hydrated)

  React.useEffect(() => {
    hydrate()
  }, [hydrate])

  React.useEffect(() => {
    if (!hydrated) return
    if (!tokens?.access_token) {
      router.replace("/login")
    }
  }, [hydrated, tokens, router])

  if (!tokens?.access_token) return null

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <div className="mt-4 text-sm space-y-2">
        <div><span className="font-medium">Username:</span> {user?.username}</div>
        <div><span className="font-medium">Email:</span> {user?.email}</div>
        <div><span className="font-medium">Email Verified:</span> {user?.email_verified ? "Yes" : "No"}</div>
      </div>
    </div>
  )
}