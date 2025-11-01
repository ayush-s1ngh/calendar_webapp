/**
 * useDebounce
 * Debounces a changing value by the given delay (ms) and returns the debounced value.
 *
 * Notes:
 * - For objects/arrays, debouncing is based on reference equality. Ensure you pass stable
 *   references or memoize upstream if needed.
 * - Typical use: user input, query params, filter values.
 */
import * as React from "react"

export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = React.useState<T>(value)

  React.useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(handle)
  }, [value, delay])

  return debounced
}