"use client"

/**
 * Global app providers composition.
 * - Hydrates auth store (tokens from localStorage)
 * - If an access token exists but user is missing, fetches /users/me (with abort on unmount)
 * - Wraps the app with ThemeProvider and Toaster
 */
import * as React from "react"
import type { JSX, ReactNode } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import api from "@/lib/api"
import { authStore } from "@/store/auth"

async function fetchMe(signal?: AbortSignal) {
  try {
    const res = await api.get("/users/me", { signal })
    return res.data?.data
  } catch {
    return null
  }
}

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  // hydrate store and pull user if token exists
  const hydrate = authStore((s) => s.hydrate)
  const hydrated = authStore((s) => s.hydrated)
  const setUser = authStore((s) => s.setUser)
  const tokens = authStore((s) => s.tokens)

  React.useEffect(() => {
    hydrate()
  }, [hydrate])

  React.useEffect(() => {
    const controller = new AbortController()

    async function run() {
      if (tokens?.access_token && !authStore.getState().user) {
        const me = await fetchMe(controller.signal)
        if (me) setUser(me)
      }
    }

    if (hydrated) {
      void run()
    }

    return () => {
      controller.abort()
    }
  }, [hydrated, tokens, setUser])

  return (
    <ThemeProvider>
      {children}
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  )
}