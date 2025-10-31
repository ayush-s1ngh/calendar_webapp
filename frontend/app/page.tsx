"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * App index route:
 * - If access token exists, go to /calendar
 * - Otherwise, go to /login
 */
export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
    router.replace(token ? "/calendar" : "/login")
  }, [router])

  return null
}