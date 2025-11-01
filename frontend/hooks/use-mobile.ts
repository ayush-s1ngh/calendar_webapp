/**
 * useIsMobile
 * Determines if the viewport is considered "mobile" based on a breakpoint (default 768px).
 * - Internally uses useMediaQuery("(max-width: BREAKPOINT-1px)")
 * - SSR-safe: returns false on the server by default to avoid hydration flicker
 *
 * Tip: If your design tokens define breakpoints, import them here to keep parity with CSS.
 */
import { useMediaQuery } from "./use-media-query"

export const MOBILE_BREAKPOINT = 768

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`
  return useMediaQuery(query, { ssrFallback: false })
}