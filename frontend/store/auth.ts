"use client"

/**
 * Auth store (canonical).
 * - Manages user, tokens, and theme preference
 * - Persists tokens to localStorage (client-only)
 * - Provides a hydrate() action to initialize state from localStorage on app start
 *
 * Notes:
 * - Keep this as the single source of truth for auth state. Do not duplicate this store.
 * - Actions:
 *    setUser(user): sets the current user object (null to clear)
 *    setTokens(tokens, persist=true): sets tokens and optionally persists them
 *    setTheme(theme): updates preferred theme ("light" | "dark" | "system")
 *    logout(): clears tokens (localStorage) and user
 *    hydrate(): reads tokens from localStorage once to initialize state
 */
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
  hydrated: boolean
  setUser: (user: User | null) => void
  setTokens: (tokens: Tokens | null, persist?: boolean) => void
  setTheme: (theme: "light" | "dark" | "system") => void
  logout: () => void
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