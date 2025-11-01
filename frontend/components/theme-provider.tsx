"use client"

/**
 * Centralized theme provider wrapper.
 * - Uses next-themes with class attribute strategy
 * - Defaults to system; transition is disabled on change to avoid flashes
 * - Keep this as the single place to adjust app-wide theme behavior
 */
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { JSX, ReactNode } from "react"

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}