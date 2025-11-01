/**
 * useMediaQuery
 * A resilient media query hook with SSR-safe initialization and Safari fallback.
 *
 * Usage:
 *   const isNarrow = useMediaQuery("(max-width: 767px)")
 *
 * Notes:
 * - Initializes from window.matchMedia on the client; during SSR it returns the provided
 *   ssrFallback (default false) to avoid hydration mismatches.
 * - Uses addEventListener('change', ...) when available, falling back to legacy addListener/removeListener
 *   in older Safari without triggering TypeScript deprecation warnings.
 */
import * as React from "react"

type LegacyMediaQueryList = {
  matches: boolean
  media: string
  addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void
  removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void
}

export function useMediaQuery(query: string, options?: { ssrFallback?: boolean }): boolean {
  const getMatch = React.useCallback(() => {
    if (typeof window === "undefined") return options?.ssrFallback ?? false
    return window.matchMedia(query).matches
  }, [query, options?.ssrFallback])

  const [matches, setMatches] = React.useState<boolean>(getMatch)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(query)

    const onChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches)
    }

    // Ensure state is in sync initially (in case query changed)
    setMatches(mql.matches)

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    }

    // Safari fallback: legacy addListener/removeListener without TS deprecation warnings
    const legacy = mql as unknown as LegacyMediaQueryList
    const legacyHandler = (ev: MediaQueryListEvent) => onChange(ev)
    legacy.addListener?.(legacyHandler)
    return () => legacy.removeListener?.(legacyHandler)
  }, [query])

  return matches
}