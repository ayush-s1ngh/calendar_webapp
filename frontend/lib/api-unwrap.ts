/**
 * api-unwrap
 * Helpers to unwrap tolerant API envelopes commonly returned by backends.
 *
 * Supported shapes:
 * - Axios response: { data: ... } or { data: { data: ... } }
 * - Raw objects or arrays
 *
 * Example:
 *   const root = unwrap<{ user: User }>(await api.get("/me"))
 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

export function unwrap<T>(resp: unknown): T {
  let root: unknown = resp

  // Axios like response: { data: ... }
  if (isRecord(root) && "data" in root) {
    root = (root as Record<string, unknown>)["data"]
  }
  // Nested { data: { data: ... } }
  if (isRecord(root) && "data" in root) {
    root = (root as Record<string, unknown>)["data"]
  }

  return root as T
}