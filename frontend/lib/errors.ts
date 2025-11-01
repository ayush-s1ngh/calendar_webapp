/**
 * Error helpers for extracting user-friendly messages from unknown values.
 * Works with Axios error shapes and plain Error objects.
 */
export type ApiError = {
  response?: { data?: { message?: string } }
  message?: string
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const e = err as ApiError
    return e.response?.data?.message ?? e.message ?? fallback
  }
  return fallback
}