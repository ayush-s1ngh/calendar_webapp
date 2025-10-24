"use client"

import { create } from "zustand"

export type User = {
  id: number
  username: string
  email: string
  email_verified?: boolean
  theme_preference?: "light" | "dark"
}

type Tokens = {
  access_token: string
  refresh_token?: string
}

type AuthState = {
  user: User | null
  tokens: Tokens | null
  theme: "light" | "dark" | "system"
  setUser: (user: User | null) => void
  setTokens: (tokens: Tokens | null, persist?: boolean) => void
  setTheme: (theme: "light" | "dark" | "system") => void
  logout: () => void
  hydrated: boolean
  hydrate: () => void
}

export const authStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  theme: "system",
  hydrated: false,
  setUser: (user) => set({ user }),
  setTokens: (tokens, persist = true) =>
    set(() => {
      if (typeof window !== "undefined" && persist && tokens) {
        localStorage.setItem("access_token", tokens.access_token)
        if (tokens.refresh_token) {
          localStorage.setItem("refresh_token", tokens.refresh_token)
        }
      }
      if (typeof window !== "undefined" && !tokens) {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
      }
      return { tokens }
    }),
  setTheme: (theme) => set({ theme }),
  logout: () =>
    set(() => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
      }
      return { user: null, tokens: null }
    }),
  hydrate: () =>
    set((state) => {
      if (state.hydrated) return state
      if (typeof window !== "undefined") {
        const access = localStorage.getItem("access_token")
        const refresh = localStorage.getItem("refresh_token") || undefined
        if (access) {
          return { tokens: { access_token: access, refresh_token: refresh }, hydrated: true }
        }
      }
      return { hydrated: true }
    }),
}))