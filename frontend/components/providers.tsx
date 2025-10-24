"use client"

import * as React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import api from "@/lib/api"
import { authStore } from "@/store/auth"

async function fetchMe() {
  try {
    const res = await api.get("/users/me")
    return res.data?.data
  } catch {
    return null
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  // hydrate store and pull user if token exists
  const hydrate = authStore((s) => s.hydrate)
  const hydrated = authStore((s) => s.hydrated)
  const setUser = authStore((s) => s.setUser)
  const tokens = authStore((s) => s.tokens)

  React.useEffect(() => {
    hydrate()
  }, [hydrate])

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      if (tokens?.access_token && !authStore.getState().user) {
        const me = await fetchMe()
        if (!cancelled && me) setUser(me)
      }
    }
    if (hydrated) run()
    return () => {
      cancelled = true
    }
  }, [hydrated, tokens, setUser])

  return (
    <ThemeProvider>
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  )
}